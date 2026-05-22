import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import { z } from 'npm:zod@3.23.8';
import { json, options, type ApiError } from '../_shared/response.ts';

const payloadSchema = z.object({
  invitationId: z.number().int().positive(),
});

interface InvitationRow {
  id: number;
  family_id: number;
  invitee_contact: string;
  invitee_contact_type: 1 | 2;
  invite_code: string;
  status: 0 | 1 | -1;
  expire_time: string;
  families: {
    family_name: string;
  } | null;
}

interface SendResult {
  sent: boolean;
  channel: 'email' | 'none';
  message: string;
  fallback: 'none' | 'manual_share';
}

function makeError(code: string, message: string): ApiError {
  return { code, message };
}

function buildInviteLink(inviteCode: string): string {
  const webBaseUrl = Deno.env.get('APP_WEB_BASE_URL')?.trim();
  if (webBaseUrl) {
    const normalized = webBaseUrl.endsWith('/') ? webBaseUrl.slice(0, -1) : webBaseUrl;
    return `${normalized}/invite?code=${encodeURIComponent(inviteCode)}`;
  }

  const appScheme = Deno.env.get('APP_SCHEME')?.trim() || 'myapp';
  return `${appScheme}://invite?code=${encodeURIComponent(inviteCode)}`;
}

async function sendEmailReminder(to: string, familyName: string, inviteCode: string): Promise<ApiError | null> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const fromEmail = Deno.env.get('INVITE_EMAIL_FROM')?.trim();

  if (!resendApiKey || !fromEmail) {
    return makeError('MISSING_EMAIL_CONFIG', '未配置邮件发送能力，请手动分享邀请链接');
  }

  const inviteLink = buildInviteLink(inviteCode);
  const subject = `${familyName} 邀请你加入家庭账本`;
  const text = [
    `你收到了来自 ${familyName} 的邀请。`,
    `邀请码：${inviteCode}`,
    `邀请链接：${inviteLink}`,
    '',
    '如非本人操作，请忽略本邮件。',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin: 0 0 12px;">${familyName} 邀请你加入家庭账本</h2>
      <p style="margin: 0 0 12px;">你可以点击下面的链接完成加入：</p>
      <p style="margin: 0 0 12px;">
        <a href="${inviteLink}" style="display:inline-block;padding:10px 14px;background:#4f46e5;color:#fff;border-radius:999px;text-decoration:none;">立即查看邀请</a>
      </p>
      <p style="margin: 0 0 4px;">邀请码：<strong>${inviteCode}</strong></p>
      <p style="margin: 0; color: #6b7280;">如非本人操作，请忽略本邮件。</p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (response.ok) return null;

  const bodyText = await response.text();
  return makeError('EMAIL_SEND_FAILED', `邮件发送失败，请手动分享邀请链接 (${bodyText || response.statusText})`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return options();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() ?? Deno.env.get('EXPO_PUBLIC_SUPABASE_URL')?.trim();
    const supabaseAnonKey =
      Deno.env.get('SUPABASE_ANON_KEY')?.trim() ?? Deno.env.get('EXPO_PUBLIC_SUPABASE_ANON_KEY')?.trim();

    if (!supabaseUrl || !supabaseAnonKey) {
      return json<SendResult>({
        data: null,
        error: makeError('MISSING_SUPABASE_CONFIG', '缺少 Supabase 环境配置'),
      }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json<SendResult>({
        data: null,
        error: makeError('UNAUTHORIZED', '未登录或会话已失效'),
      }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return json<SendResult>({
        data: null,
        error: makeError('UNAUTHORIZED', '未登录或会话已失效'),
      }, 401);
    }

    const rawPayload = await req.json();
    const parsed = payloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return json<SendResult>({
        data: null,
        error: makeError('INVALID_PAYLOAD', '请求参数不合法'),
      }, 400);
    }

    const invitationId = parsed.data.invitationId;

    const { data: invitation, error: invitationError } = await supabase
      .from('family_invitations')
      .select('id, family_id, invitee_contact, invitee_contact_type, invite_code, status, expire_time, families(family_name)')
      .eq('id', invitationId)
      .maybeSingle<InvitationRow>();

    if (invitationError || !invitation) {
      return json<SendResult>({
        data: null,
        error: makeError('INVITATION_NOT_FOUND', '邀请不存在'),
      }, 404);
    }

    const { data: adminMember } = await supabase
      .from('family_members')
      .select('id')
      .eq('family_id', invitation.family_id)
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .eq('status', 1)
      .maybeSingle();

    if (!adminMember) {
      return json<SendResult>({
        data: null,
        error: makeError('FORBIDDEN', '仅家庭管理员可发送邀请提醒'),
      }, 403);
    }

    if (invitation.status !== 0) {
      return json<SendResult>({
        data: null,
        error: makeError('INVITATION_INACTIVE', '仅待确认状态邀请可发送提醒'),
      }, 400);
    }

    const expired = new Date(invitation.expire_time).getTime() <= Date.now();
    if (expired) {
      return json<SendResult>({
        data: null,
        error: makeError('INVITATION_EXPIRED', '邀请已过期'),
      }, 400);
    }

    if (invitation.invitee_contact_type !== 2) {
      return json<SendResult>({
        data: {
          sent: false,
          channel: 'none',
          message: '手机号邀请暂不支持自动提醒，请手动分享邀请链接',
          fallback: 'manual_share',
        },
        error: null,
      });
    }

    const familyName = invitation.families?.family_name?.trim() || '家庭账本';
    const emailError = await sendEmailReminder(invitation.invitee_contact, familyName, invitation.invite_code);
    if (emailError) {
      return json<SendResult>({
        data: {
          sent: false,
          channel: 'none',
          message: emailError.message,
          fallback: 'manual_share',
        },
        error: null,
      });
    }

    const { error: updateError } = await supabase
      .from('family_invitations')
      .update({
        last_send_time: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    if (updateError) {
      return json<SendResult>({
        data: null,
        error: makeError('UPDATE_FAILED', '提醒发送成功，但记录发送时间失败'),
      }, 500);
    }

    return json<SendResult>({
      data: {
        sent: true,
        channel: 'email',
        message: '邮箱提醒已发送',
        fallback: 'none',
      },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务异常';
    return json<SendResult>({
      data: null,
      error: makeError('INTERNAL_ERROR', message),
    }, 500);
  }
});
