import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Colors } from '@/constants/Colors';

export interface FamilyInvitationPrompt {
  invitation_id: number;
  family_id: number;
  family_name: string;
  family_avatar: string | null;
  inviter_name: string | null;
  expire_time: string;
}

interface FamilyInvitationPromptModalProps {
  visible: boolean;
  invitation: FamilyInvitationPrompt | null;
  loading: boolean;
  onAccept: () => void;
  onReject: () => void;
}

function formatExpire(expireTime: string): string {
  const date = new Date(expireTime);
  if (Number.isNaN(date.getTime())) {
    return '邀请有效期有限，请尽快处理';
  }
  return `请在${date.getMonth() + 1}月${date.getDate()}日前处理邀请`;
}

export function FamilyInvitationPromptModal({
  visible,
  invitation,
  loading,
  onAccept,
  onReject,
}: FamilyInvitationPromptModalProps) {
  const inviterLabel = invitation?.inviter_name?.trim() || '家庭管理员';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(36, 31, 68, 0.3)' }}>
        <View
          className="w-full rounded-3xl px-5 pt-6 pb-5"
          style={{
            maxWidth: 360,
            backgroundColor: 'rgba(245, 243, 255, 0.96)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.75)',
            shadowColor: Colors.shadow,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 1,
            shadowRadius: 24,
            elevation: 8,
          }}
        >
          <View
            className="rounded-3xl px-5 pt-5 pb-4 items-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' }}
          >
            <Avatar uri={invitation?.family_avatar ?? null} name={invitation?.family_name ?? '家庭'} size="lg" />
            <Text className="text-3xl mt-3">✨</Text>
            <Text className="mt-1 text-4xl font-semibold" style={{ color: Colors.text.primary }}>
              {invitation?.family_name ?? '家庭邀请'}
            </Text>
            <Text className="mt-1 text-lg" style={{ color: Colors.text.secondary }}>
              {inviterLabel} 邀请你加入
            </Text>
          </View>

          <View
            className="mt-4 rounded-3xl px-5 py-4"
            style={{ backgroundColor: 'rgba(255,255,255,0.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' }}
          >
            <Text className="text-center text-base leading-6" style={{ color: Colors.text.primary }}>
              加入家庭后可共享家庭账本，并协同管理资产与收支记录。
            </Text>
          </View>

          <View className="mt-5 flex-row items-center">
            <TouchableOpacity
              className="flex-1 rounded-full py-3.5 items-center mr-2"
              style={{ backgroundColor: Colors.primary, opacity: loading ? 0.75 : 1 }}
              onPress={onAccept}
              disabled={loading || !invitation}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white text-xl font-semibold">接受邀请</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              className="rounded-full py-3.5 px-7 items-center"
              style={{ backgroundColor: '#E5E7EB', opacity: loading ? 0.7 : 1 }}
              onPress={onReject}
              disabled={loading || !invitation}
            >
              <Text className="text-xl font-semibold" style={{ color: '#4B5563' }}>拒绝</Text>
            </TouchableOpacity>
          </View>

          <Text className="mt-4 text-center text-xs" style={{ color: Colors.text.tertiary }}>
            {invitation ? formatExpire(invitation.expire_time) : ''}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
