import React, { useState, useEffect } from 'react';
import { Switch, Select, PasswordInput, Button, Stack, Group, Divider, Progress, Text, List, ActionIcon, Badge, Table, ScrollArea } from '@mantine/core';
import { Typography } from '@mantine/core';
import { Tabs } from '@mantine/core';
import { useForm } from '@mantine/form';
import { Alert } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useI18n } from '../hooks/useI18n';
import { DEFAULT_CONFIG } from '../config';
import { STORAGE_KEYS } from '../constants';
import { AIProvider, LearnedRule } from '../types';
import './App.css';

/** 配置表单的数据结构 */
interface ConfigForm {
  /** AI 提供商 */
  aiProvider: AIProvider;
  /** AI 模型名称 */
  aiModel: string;
  /** Gemini API 密钥 */
  apiKey: string;
  /** DeepSeek API 密钥 */
  deepseekApiKey: string;
}

const App: React.FC = () => {
  const { t } = useI18n();
  const [autoSkip, setAutoSkip] = useState<boolean>(DEFAULT_CONFIG.autoSkip);
  const [ignoreVideoLessThan5Minutes, setignoreVideoLessThan5Minutes] = useState<boolean>(DEFAULT_CONFIG.ignoreVideoLessThan5Minutes);
  const [ignoreVideoMoreThan30Minutes, setIgnoreVideoMoreThan30Minutes] = useState<boolean>(DEFAULT_CONFIG.ignoreVideoMoreThan30Minutes);

  const [browserModelReachable, setBrowserModelReachable] = useState<boolean>(false);
  const [browserModelDownloadProgress, updateBrowserModelDownloadProgress] = useState<number>(0);
  const [browserModelInDownloading, setBrowserModelInDownloading] = useState<boolean>(false);
  const [browserModelAvailable, setBrowserModelAvailable] = useState<boolean>(false);
  const [usingBrowserAIModel, setUsingBrowserAIModel] = useState<boolean>(DEFAULT_CONFIG.usingBrowserAIModel);
  const [learnedRules, setLearnedRules] = useState<LearnedRule[]>([]);

  /**
   * 检查浏览器内置 AI 模型的可用性
   * @returns 模型是否可用（available 状态返回 true）
   */
  async function checkLocalModelAvailability(): Promise<boolean> {
    if (!window.LanguageModel) {
      showFailedNotification(t("browserModelNotSupported"))
      setBrowserModelReachable(false);
      setBrowserModelAvailable(false)
      return false;
    }

    const availability = await LanguageModel.availability({
      languages: ["cn"]
    });
    
    console.log("📺 🤖 Browser AI model availability", availability);
    if (availability == "unavailable") {
      showFailedNotification(t("browserModelNotSupported"))
      setBrowserModelInDownloading(false);
      setBrowserModelReachable(false);
      setBrowserModelAvailable(false)
      return false;
    }

    if (availability == "downloadable") {
      showSuccessNotification(t("modelIsDownloading"))
      downloadLocalModel();
      setBrowserModelInDownloading(false);
      setBrowserModelReachable(true);
      setBrowserModelAvailable(false)
      return false;
    }

    if (availability == "available") {
      setBrowserModelInDownloading(false);
      setBrowserModelReachable(true);
      setBrowserModelAvailable(true)
      return true;
    }


    if (availability == "downloading") {
      showSuccessNotification(t("modelIsDownloading"))
      setBrowserModelInDownloading(true);
      setBrowserModelReachable(true);
      setBrowserModelAvailable(false)
      return false;
    }

    return false;
  }

  /** 触发浏览器内置 AI 模型的下载（当前为占位实现） */
  async function downloadLocalModel() {
    return;

    if (!window.LanguageModel) {
      return;
    }

    try {
      await LanguageModel.create({
        monitor(m) {
          m.addEventListener('downloadprogress', (e:any) => {
            const downloadprogress = Math.round(e.loaded * 100);
            console.log("Download progress", downloadprogress)
          });
        },
      });
    } catch (error) {
      console.log(error);
      showFailedNotification(t('failedToDownloadModel'))
    }
  }
  
  useEffect(() => {
    const loadSettings = async () => {
      const result = await chrome.storage.local.get(['autoSkip', 'usingBrowserAIModel', 'ignoreVideoLessThan5Minutes', 'ignoreVideoMoreThan30Minutes']);
      console.log("📺 ✔️ Loading settings:", result.autoSkip, result.usingBrowserAIModel, result.ignoreVideoLessThan5Minutes, result.ignoreVideoMoreThan30Minutes);
      if (result.autoSkip !== undefined) {
        setAutoSkip(result.autoSkip);
      } else {
        await chrome.storage.local.set({ autoSkip: DEFAULT_CONFIG.autoSkip });
      }

      if (result.usingBrowserAIModel !== undefined) {
        setUsingBrowserAIModel(result.usingBrowserAIModel);
      } else {
        await chrome.storage.local.set({ usingBrowserAIModel: DEFAULT_CONFIG.usingBrowserAIModel });
      }

      if (result.ignoreVideoLessThan5Minutes !== undefined) {
        setignoreVideoLessThan5Minutes(result.ignoreVideoLessThan5Minutes);
      } else {
        await chrome.storage.local.set({ ignoreVideoLessThan5Minutes: DEFAULT_CONFIG.ignoreVideoLessThan5Minutes });
      }

      if (result.ignoreVideoMoreThan30Minutes !== undefined) {
        setIgnoreVideoMoreThan30Minutes(result.ignoreVideoMoreThan30Minutes);
      } else {
        await chrome.storage.local.set({ ignoreVideoMoreThan30Minutes: DEFAULT_CONFIG.ignoreVideoMoreThan30Minutes });
      }
    };
    
    loadSettings();
    loadLearnedRules();
    // checkLocalModelAvailability();
  }, []);

  const loadLearnedRules = async () => {
    const result = await chrome.storage.local.get(STORAGE_KEYS.LEARNED_AD_RULES);
    const rules = result[STORAGE_KEYS.LEARNED_AD_RULES] || [];
    setLearnedRules(rules);
  };

  const deleteLearnedRule = async (keyword: string) => {
    const updated = learnedRules.filter(r => r.keyword !== keyword);
    await chrome.storage.local.set({ [STORAGE_KEYS.LEARNED_AD_RULES]: updated });
    setLearnedRules(updated);
    showSuccessNotification('Rule deleted');
  };

  const clearAllLearnedRules = async () => {
    await chrome.storage.local.set({ [STORAGE_KEYS.LEARNED_AD_RULES]: [] });
    setLearnedRules([]);
    showSuccessNotification('All rules cleared');
  };

  /**
   * 显示绿色成功通知
   * @param message - 通知消息文本
   */
  const showSuccessNotification = (message: string) => {
    notifications.show({
      title: t('saved'),
      message: message,
      color: 'green',
      position: 'top-right',
    });
  }

  /**
   * 显示红色错误通知
   * @param message - 通知消息文本
   */
  const showFailedNotification = (message: string) => {
    notifications.show({
      title: t('error'),
      message: message,
      color: 'red',
      position: 'top-right',
    });
  }

  /**
   * 更新"自动跳过广告"设置并保存到 Chrome 存储
   * @param value - 是否开启自动跳过
   */
  const updateAutoSkip = async (value: boolean) => {
    setAutoSkip(value);
    await chrome.storage.local.set({ autoSkip: value });
    showSuccessNotification(t('refreshToApply'));
  }

  /**
   * 更新"使用浏览器内置 AI"设置，先检查模型可用性
   * @param value - 是否使用浏览器 AI
   */
  const updateUsingBrowserAIModel = async (value: boolean) => {
    const browserAIModelAvailable = await checkLocalModelAvailability();
    if (!browserAIModelAvailable) {
      return;
    }
    
    setUsingBrowserAIModel(value);
    await chrome.storage.local.set({ usingBrowserAIModel: value });
    showSuccessNotification(t('refreshToApply'));
  }

  /**
   * 更新"忽略 5 分钟以下视频"设置并保存到 Chrome 存储
   * @param value - 是否忽略短视频
   */
  const updateignoreVideoLessThan5Minutes = async (value: boolean) => {
    setignoreVideoLessThan5Minutes(value);
    await chrome.storage.local.set({ ignoreVideoLessThan5Minutes: value });
    showSuccessNotification(t('refreshToApply'));
  }

  /**
   * 更新"忽略 30 分钟以上视频"设置并保存到 Chrome 存储
   * @param value - 是否忽略长视频
   */
  const updateIgnoreVideoMoreThan30Minutes = async (value: boolean) => {
    setIgnoreVideoMoreThan30Minutes(value);
    await chrome.storage.local.set({ ignoreVideoMoreThan30Minutes: value });
    showSuccessNotification(t('refreshToApply'));
  }

  const form = useForm<ConfigForm>({
    mode: 'uncontrolled',
    initialValues: {
      aiProvider: DEFAULT_CONFIG.aiProvider,
      aiModel: DEFAULT_CONFIG.aiModel,
      apiKey: DEFAULT_CONFIG.apiKey,
      deepseekApiKey: DEFAULT_CONFIG.deepseekApiKey,
    },
  });

  useEffect(() => {
    const loadFormData = async () => {
      const result = await chrome.storage.local.get(['aiProvider', 'aiModel', 'apiKey', 'deepseekApiKey']);

      form.setValues({
        aiProvider: result.aiProvider || DEFAULT_CONFIG.aiProvider,
        aiModel: result.aiModel || DEFAULT_CONFIG.aiModel,
        apiKey: result.apiKey || DEFAULT_CONFIG.apiKey,
        deepseekApiKey: result.deepseekApiKey || DEFAULT_CONFIG.deepseekApiKey,
      });
      form.resetDirty();
    };

    loadFormData();
  }, []);

  /**
   * 提交配置表单 — 将 AI 模型和 API Key 保存到 Chrome 存储
   * @param values - 表单数据（aiModel、apiKey）
   */
  const handleSubmit = async (values: ConfigForm) => {
    console.log('Saving config:', values);
    await chrome.storage.local.set({
      aiProvider: values.aiProvider,
      aiModel: values.aiModel,
      apiKey: values.apiKey,
      deepseekApiKey: values.deepseekApiKey,
    });
    form.resetDirty();
    showSuccessNotification(t('refreshToApply'));
  };

  return (
    <Tabs defaultValue="config" styles={{ tabLabel: { fontSize: "13px" } }}>
      <Tabs.List>
        <Tabs.Tab value="config">
          {t('configTab')}
        </Tabs.Tab>
        <Tabs.Tab value="instructions">
          {t('instructionsTab')}
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="config">
        <div className="app" style={{ padding: '18px', color: 'inherit' }}>
          <Stack gap="sm">
            <Divider size="xs" label={t('basicConfig')} labelPosition='center'></Divider>
            <Switch
              label={t('autoSkipAds')}
              labelPosition="left"
              size="sm"
              styles={{
                body: { justifyContent: 'space-between' },
                trackLabel: { width: '100%' },
                label: { fontSize: '13px' }
              }}
              checked={autoSkip}
              onChange={(event) => updateAutoSkip(event.currentTarget.checked)}
            />
            {/* <Switch
              label={t('usingBrowserAIModel')}
              labelPosition="left"
              size="sm"
              styles={{
                body: { justifyContent: 'space-between' },
                trackLabel: { width: '100%' },
                label: { fontSize: '13px' }
              }}
              checked={usingBrowserAIModel}
              onChange={(event) => updateUsingBrowserAIModel(event.currentTarget.checked)}
            /> */}
            <Switch
              label={t('ignoreVideoLessThan5Minutes')}
              labelPosition="left"
              size="sm"
              styles={{
                body: { justifyContent: 'space-between' },
                trackLabel: { width: '100%' },
                label: { fontSize: '13px' }
              }}
              checked={ignoreVideoLessThan5Minutes}
              onChange={(event) => updateignoreVideoLessThan5Minutes(event.currentTarget.checked)}
            />
            <Switch
              label={t('ignoreVideoMoreThan30Minutes')}
              labelPosition="left"
              size="sm"
              styles={{
                body: { justifyContent: 'space-between' },
                trackLabel: { width: '100%' },
                label: { fontSize: '13px' }
              }}
              checked={ignoreVideoMoreThan30Minutes}
              onChange={(event) => updateIgnoreVideoMoreThan30Minutes(event.currentTarget.checked)}
            />
          </Stack>
          <form onSubmit={form.onSubmit(handleSubmit)} onReset={form.onReset}>
            <Stack gap="sm">
              <div>
                <Divider my="xs" label={t('aiConfig')} labelPosition="center" styles={{
                  root: {
                    marginBlock: 0,
                    marginBottom: "0px"
                  }
                }} />
                <Select
                  {...form.getInputProps('aiProvider')}
                  key={form.key('aiProvider')}
                  label="AI Provider"
                  size="xs"
                  data={[
                    { value: 'gemini', label: 'Google Gemini' },
                    { value: 'deepseek', label: 'DeepSeek' },
                  ]}
                  onChange={(value) => {
                    form.setFieldValue('aiProvider', value as AIProvider);
                    if (value === 'deepseek') {
                      form.setFieldValue('aiModel', 'deepseek-chat');
                    } else {
                      form.setFieldValue('aiModel', 'gemini-2.5-flash');
                    }
                  }}
                />
                <Select
                  {...form.getInputProps('aiModel')}
                  key={form.key('aiModel')}
                  label={t('aiModel')}
                  placeholder="Pick value"
                  maxDropdownHeight={100}
                  searchable
                  size="xs"
                  data={
                    form.getValues().aiProvider === 'gemini'
                      ? [
                          {
                            group: 'Gemini',
                            items: [
                              { value: 'gemini-3.0-flash', label: 'gemini-3.0-flash' },
                              { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
                              { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
                            ],
                          },
                        ]
                      : [
                          {
                            group: 'DeepSeek',
                            items: [
                              { value: 'deepseek-chat', label: 'deepseek-chat' },
                              { value: 'deepseek-reasoner', label: 'deepseek-reasoner' },
                            ],
                          },
                        ]
                  }
                />

                {form.getValues().aiProvider === 'gemini' ? (
                  <PasswordInput
                    label="Gemini API Key"
                    placeholder={t('enterApiKey')}
                    {...form.getInputProps('apiKey')}
                    size="xs"
                  />
                ) : (
                  <PasswordInput
                    label="DeepSeek API Key"
                    placeholder={t('enterApiKey')}
                    {...form.getInputProps('deepseekApiKey')}
                    size="xs"
                  />
                )}

              </div>
              <Group justify="flex-end" mt="sm" gap="xs">
                <Button type="submit" size="xs" disabled={!form.isDirty()}>
                  {t('save')}
                </Button>
              </Group>
            </Stack>
          </form>
          <div style={{ marginTop: '8px' }}>
            <Divider my="xs" label="自学习广告规则" labelPosition="center" styles={{
              root: { marginBlock: 0, marginBottom: "0px" }
            }} />
            {learnedRules.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="xs">暂无自学习规则</Text>
            ) : (
              <>
                <ScrollArea h={120} type="auto">
                  <Table striped highlightOnHover withTableBorder withColumnBorders styles={{ table: { fontSize: '12px' } }}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ fontSize: '11px' }}>关键词</Table.Th>
                        <Table.Th style={{ fontSize: '11px', width: '40px' }}>命中</Table.Th>
                        <Table.Th style={{ fontSize: '11px', width: '40px' }}></Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {learnedRules.map((rule) => (
                        <Table.Tr key={rule.keyword}>
                          <Table.Td style={{ fontSize: '11px' }}>{rule.keyword}</Table.Td>
                          <Table.Td style={{ fontSize: '11px' }}>
                            <Badge size="xs" variant="light">{rule.hitCount}</Badge>
                          </Table.Td>
                          <Table.Td>
                            <Button
                              size="compact-xs"
                              variant="subtle"
                              color="red"
                              onClick={() => deleteLearnedRule(rule.keyword)}
                              styles={{ root: { fontSize: '10px', padding: '0 4px' } }}
                            >
                              X
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
                <Group justify="flex-end" mt="xs">
                  <Button size="compact-xs" color="red" variant="light" onClick={clearAllLearnedRules}>
                    清空全部
                  </Button>
                </Group>
              </>
            )}
          </div>
        </div>
      </Tabs.Panel>

      <Tabs.Panel value="instructions">
        <div style={{ padding: '18px'}}>
          <Text 
            size="sm"
            fw={600}
          >
            {t('howToUse')}
          </Text>
          <List size="sm">
            <List.Item><a href="https://github.com/hh54188/bilibili-ad-killer" target="_blank">English Version</a></List.Item>
            <List.Item><a href="https://www.v2think.com/ad-killer" target="_blank">中文教程</a></List.Item>
          </List>
        </div>
        <div style={{ padding: '18px'}}>
          <Text 
            size="sm"
            fw={600}
          >
            {t('sourceCode')}
          </Text>
          <List size="sm">
            <List.Item><a href="https://github.com/hh54188/bilibili-ad-killer" target="_blank">GitHub</a></List.Item>
          </List>
        </div>
      </Tabs.Panel>

    </Tabs>
  );
};

export default App;
