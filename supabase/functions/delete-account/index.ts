// Edge Function: delete-account
// 用途：满足 App Store Guideline 5.1.1(v) — 允许已注册用户在 App 内删除账号及其数据
//
// 流程：
//   1. 校验调用者会话
//   2. 校验确认字段（必须传入与当前邮箱一致的 confirmEmail）
//   3. 删除当前用户在业务表中的数据（asset_accounts 通过 member_id 级联，
//      family_members 通过 profile_id 直接删除；只剩自己的 family 也一并删除）
//   4. 调用 auth.admin.deleteUser 删除 auth 用户（profiles 通过 ON DELETE CASCADE 级联清理）
//
// 必需的 Edge Function Secrets：
//   - SUPABASE_URL
//   - SUPABASE_ANON_KEY
//   - SUPABASE_SERVICE_ROLE_KEY  ← 仅在服务端使用，绝不能暴露到客户端

import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import { z } from 'npm:zod@3.23.8';
import { json, options, type ApiError } from '../_shared/response.ts';

const payloadSchema = z.object({
  confirmEmail: z.string().email(),
});

interface DeleteResult {
  deleted: true;
}

function makeError(code: string, message: string): ApiError {
  return { code, message };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return options();

  try {
    const supabaseUrl =
      Deno.env.get('SUPABASE_URL')?.trim() ?? Deno.env.get('EXPO_PUBLIC_SUPABASE_URL')?.trim();
    const supabaseAnonKey =
      Deno.env.get('SUPABASE_ANON_KEY')?.trim() ?? Deno.env.get('EXPO_PUBLIC_SUPABASE_ANON_KEY')?.trim();
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json<DeleteResult>(
        { data: null, error: makeError('MISSING_SUPABASE_CONFIG', '缺少 Supabase 环境配置') },
        500,
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json<DeleteResult>(
        { data: null, error: makeError('UNAUTHORIZED', '未登录或会话已失效') },
        401,
      );
    }

    // 用调用者 token 校验身份
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json<DeleteResult>(
        { data: null, error: makeError('UNAUTHORIZED', '未登录或会话已失效') },
        401,
      );
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email ?? '';

    let rawPayload: unknown;
    try {
      rawPayload = await req.json();
    } catch {
      return json<DeleteResult>(
        { data: null, error: makeError('INVALID_PAYLOAD', '请求参数不合法') },
        400,
      );
    }

    const parsed = payloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return json<DeleteResult>(
        { data: null, error: makeError('INVALID_PAYLOAD', '请求参数不合法') },
        400,
      );
    }

    if (parsed.data.confirmEmail.trim().toLowerCase() !== userEmail.toLowerCase()) {
      return json<DeleteResult>(
        { data: null, error: makeError('EMAIL_MISMATCH', '确认邮箱与账号邮箱不一致') },
        400,
      );
    }

    // 用 service role 客户端做删除
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. 找到该用户加入的所有 family_members 行
    const { data: memberships, error: memberFetchError } = await adminClient
      .from('family_members')
      .select('id, family_id, role')
      .eq('profile_id', userId);

    if (memberFetchError) {
      return json<DeleteResult>(
        { data: null, error: makeError('DB_ERROR', `查询家庭成员失败: ${memberFetchError.message}`) },
        500,
      );
    }

    // 2. 对每一个 family，如果当前用户是 admin 且家庭中没有其他活跃成员，则删除该 family
    const familyIdsToCheck = Array.from(new Set((memberships ?? []).map((m) => m.family_id)));
    for (const familyId of familyIdsToCheck) {
      const { data: otherMembers, error: othersError } = await adminClient
        .from('family_members')
        .select('id', { count: 'exact' })
        .eq('family_id', familyId)
        .neq('profile_id', userId);

      if (othersError) {
        return json<DeleteResult>(
          { data: null, error: makeError('DB_ERROR', `查询家庭其他成员失败: ${othersError.message}`) },
          500,
        );
      }

      if (!otherMembers || otherMembers.length === 0) {
        // 整个家庭只有当前用户 → 删除 family（级联 family_members、asset_accounts、invitations）
        const { error: delFamilyError } = await adminClient
          .from('families')
          .delete()
          .eq('id', familyId);

        if (delFamilyError) {
          return json<DeleteResult>(
            { data: null, error: makeError('DB_ERROR', `删除家庭失败: ${delFamilyError.message}`) },
            500,
          );
        }
      }
    }

    // 3. 删除当前用户残留的 family_members 行（asset_accounts 通过 member_id 级联）
    const { error: delMemberError } = await adminClient
      .from('family_members')
      .delete()
      .eq('profile_id', userId);

    if (delMemberError) {
      return json<DeleteResult>(
        { data: null, error: makeError('DB_ERROR', `删除家庭成员记录失败: ${delMemberError.message}`) },
        500,
      );
    }

    // 4. 删除 auth 用户（profiles 通过 ON DELETE CASCADE 级联清理）
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      return json<DeleteResult>(
        { data: null, error: makeError('AUTH_DELETE_FAILED', `删除账号失败: ${deleteAuthError.message}`) },
        500,
      );
    }

    return json<DeleteResult>({ data: { deleted: true }, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return json<DeleteResult>(
      { data: null, error: makeError('UNEXPECTED', message) },
      500,
    );
  }
});
