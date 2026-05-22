import { ActivityIndicator, Alert, Modal, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors } from '@/constants/Colors';
import { exportFamilyAssetWorkbook, importFamilyAssetWorkbook, pickWorkbookForImport, shareExportedWorkbook } from '@/lib/familyAssetExcel';
import type { FamilyDetail } from './FamilySettingsModal';

interface Props {
  visible: boolean;
  onClose: () => void;
  family?: FamilyDetail | null;
}

type TransferAction = 'import' | 'export' | null;
type Status = 'idle' | 'running' | 'success' | 'error';

export function FamilyDataTransferModal({ visible, onClose, family }: Props) {
  const [transferingAction, setTransferingAction] = useState<TransferAction>(null);
  const [importStatus, setImportStatus] = useState<{
    fileName: string;
    sheetName: string;
    uploadStatus: Status;
    storageStatus: Status;
    parsedCount: number;
    storedCount: number;
    message: string;
  }>({
    fileName: '',
    sheetName: '',
    uploadStatus: 'idle',
    storageStatus: 'idle',
    parsedCount: 0,
    storedCount: 0,
    message: '',
  });

  useEffect(() => {
    if (!visible) {
      setImportStatus({
        fileName: '',
        sheetName: '',
        uploadStatus: 'idle',
        storageStatus: 'idle',
        parsedCount: 0,
        storedCount: 0,
        message: '',
      });
    }
  }, [visible]);

  function getStatusMeta(status: Status) {
    switch (status) {
      case 'running':
        return { label: '进行中', textColor: Colors.primary, bgColor: Colors.primaryBg };
      case 'success':
        return { label: '已完成', textColor: '#059669', bgColor: '#D1FAE5' };
      case 'error':
        return { label: '失败', textColor: Colors.danger, bgColor: Colors.dangerBg };
      default:
        return { label: '未开始', textColor: Colors.text.secondary, bgColor: '#F3F4F6' };
    }
  }

  async function handleExportExcel() {
    if (!family) {
      Alert.alert('暂不可用', '请先创建家庭后再导出数据');
      return;
    }

    setTransferingAction('export');
    try {
      const result = await exportFamilyAssetWorkbook({
        familyId: family.id,
        familyName: family.family_name,
        currency: family.currency,
      });

      await shareExportedWorkbook(result.fileUri);
      Alert.alert(
        '导出成功',
        Platform.OS === 'web'
          ? `Excel 已开始下载，共导出 ${result.summaryCount} 条家庭月度汇总、${result.memberSummaryCount} 条成员月度汇总、${result.detailCount} 条账户明细行、${result.memberRecordCount} 条成员资产记录。`
          : `已生成 Excel 并打开分享，共导出 ${result.summaryCount} 条家庭月度汇总、${result.memberSummaryCount} 条成员月度汇总、${result.detailCount} 条账户明细行、${result.memberRecordCount} 条成员资产记录。`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出失败，请稍后重试';
      Alert.alert('导出失败', message);
    } finally {
      setTransferingAction(null);
    }
  }

  async function handleImportExcel() {
    if (!family) {
      Alert.alert('暂不可用', '请先创建家庭后再导入数据');
      return;
    }

    setTransferingAction('import');
    try {
      const pickedAsset = await pickWorkbookForImport();
      if (!pickedAsset) {
        return;
      }

      setImportStatus({
        fileName: pickedAsset.name ?? '已选 Excel',
        sheetName: '',
        uploadStatus: 'running',
        storageStatus: 'idle',
        parsedCount: 0,
        storedCount: 0,
        message: '已选择文件，正在上传并解析 Excel 数据…',
      });

      const result = await importFamilyAssetWorkbook({
        familyId: family.id,
        fileUri: pickedAsset.uri,
        onProgress: (progress) => {
          setImportStatus((current) => ({
            ...current,
            sheetName: progress.sheetName ?? current.sheetName,
            parsedCount: progress.parsedCount ?? current.parsedCount,
            storedCount: progress.storedCount ?? current.storedCount,
            uploadStatus: progress.stage === 'uploading' ? progress.status : current.uploadStatus,
            storageStatus: progress.stage === 'storing' ? progress.status : current.storageStatus,
            message: progress.stage === 'uploading'
              ? `Excel 数据上传完成，已解析 ${progress.parsedCount ?? current.parsedCount} 条记录。`
              : `正在写入数据库，已存储 ${progress.storedCount ?? current.storedCount} / ${progress.parsedCount ?? current.parsedCount} 条数据。`,
          }));
        },
      });

      setImportStatus((current) => ({
        ...current,
        sheetName: result.sheetName,
        uploadStatus: 'success',
        storageStatus: 'success',
        parsedCount: result.importedCount,
        storedCount: result.storedCount,
        message: `数据已成功写入数据库，共存储 ${result.storedCount} 条记录。`,
      }));

      Alert.alert('导入成功', `已从 ${result.sheetName} 导入并存储 ${result.storedCount} 条月度资产数据。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败，请稍后重试';
      setImportStatus((current) => ({
        ...current,
        uploadStatus: current.uploadStatus === 'running' ? 'error' : current.uploadStatus,
        storageStatus: current.storageStatus === 'running' || current.uploadStatus === 'success' ? 'error' : current.storageStatus,
        message,
      }));
      Alert.alert('导入失败', message);
    } finally {
      setTransferingAction(null);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(124,58,237,0.18)', justifyContent: 'flex-end' }}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View
            style={{
              backgroundColor: '#F5F3FF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingBottom: Platform.OS === 'ios' ? 34 : 20,
            }}
          >
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 rounded-full bg-purple-200" />
            </View>

            <Text className="text-center text-base font-semibold text-gray-800 py-3">
              数据导入 / 导出
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
            >
              <View
                className="rounded-2xl px-4 py-4"
                style={{ backgroundColor: 'rgba(255,255,255,0.82)', shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 }}
              >
                <Text className="text-sm font-medium text-gray-700">家庭管理</Text>
                <Text className="text-xs text-gray-400 mt-1 leading-5">
                  历史资产 Excel 的导入与导出统一放在家庭管理条目下。导入时会展示上传状态和数据库存储状态。
                </Text>

                <View style={{ flexDirection: 'row', marginTop: 14, gap: 10 }}>
                  <TouchableOpacity
                    onPress={handleImportExcel}
                    disabled={Boolean(transferingAction)}
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      borderRadius: 16,
                      paddingVertical: 14,
                      paddingHorizontal: 12,
                      backgroundColor: 'rgba(245,243,255,0.95)',
                      borderWidth: 1,
                      borderColor: '#DDD6FE',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: transferingAction && transferingAction !== 'import' ? 0.6 : 1,
                    }}
                  >
                    {transferingAction === 'import' ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <MaterialCommunityIcons name="file-import-outline" size={18} color={Colors.primary} />
                    )}
                    <Text style={{ marginLeft: 8, color: Colors.primary, fontSize: 14, fontWeight: '600' }}>
                      导入 Excel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleExportExcel}
                    disabled={Boolean(transferingAction)}
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      borderRadius: 16,
                      paddingVertical: 14,
                      paddingHorizontal: 12,
                      backgroundColor: Colors.primary,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: transferingAction && transferingAction !== 'export' ? 0.6 : 1,
                    }}
                  >
                    {transferingAction === 'export' ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <MaterialCommunityIcons name="file-excel-box-outline" size={18} color="#fff" />
                    )}
                    <Text style={{ marginLeft: 8, color: '#fff', fontSize: 14, fontWeight: '600' }}>
                      导出 Excel
                    </Text>
                  </TouchableOpacity>
                </View>

                {(importStatus.uploadStatus !== 'idle' || importStatus.storageStatus !== 'idle') ? (
                  <View
                    className="rounded-2xl mt-4 px-4 py-4"
                    style={{ backgroundColor: '#FAF5FF', borderWidth: 1, borderColor: '#E9D5FF' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text.primary }}>导入状态</Text>
                    {importStatus.fileName ? (
                      <Text style={{ fontSize: 12, color: Colors.text.secondary, marginTop: 4 }}>
                        文件：{importStatus.fileName}
                        {importStatus.sheetName ? ` · 工作表：${importStatus.sheetName}` : ''}
                      </Text>
                    ) : null}

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                      <View
                        style={{
                          flex: 1,
                          borderRadius: 14,
                          paddingHorizontal: 12,
                          paddingVertical: 12,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#E9D5FF',
                        }}
                      >
                        <Text style={{ fontSize: 12, color: Colors.text.secondary }}>数据上传状态</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                          <View
                            style={{
                              borderRadius: 999,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              backgroundColor: getStatusMeta(importStatus.uploadStatus).bgColor,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: getStatusMeta(importStatus.uploadStatus).textColor }}>
                              {getStatusMeta(importStatus.uploadStatus).label}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 12, color: Colors.text.primary, marginTop: 8 }}>
                          已解析 {importStatus.parsedCount} 条记录
                        </Text>
                      </View>

                      <View
                        style={{
                          flex: 1,
                          borderRadius: 14,
                          paddingHorizontal: 12,
                          paddingVertical: 12,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#E9D5FF',
                        }}
                      >
                        <Text style={{ fontSize: 12, color: Colors.text.secondary }}>数据存储状态</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                          <View
                            style={{
                              borderRadius: 999,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              backgroundColor: getStatusMeta(importStatus.storageStatus).bgColor,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: getStatusMeta(importStatus.storageStatus).textColor }}>
                              {getStatusMeta(importStatus.storageStatus).label}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 12, color: Colors.text.primary, marginTop: 8 }}>
                          已存储 {importStatus.storedCount} 条记录
                        </Text>
                      </View>
                    </View>

                    {importStatus.message ? (
                      <Text style={{ fontSize: 12, color: Colors.text.secondary, marginTop: 12, lineHeight: 18 }}>
                        {importStatus.message}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
