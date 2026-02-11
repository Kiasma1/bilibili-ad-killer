import React, { useState, useEffect } from 'react';
import { Switch, Select, PasswordInput, Button, Stack, Group, Divider, Text, List } from '@mantine/core';
import { Tabs } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useI18n } from '../hooks/useI18n';
import { DEFAULT_CONFIG } from '../config';
import './App.css';

/** 配置表单的数据结构 */
interface ConfigForm {
  /** AI 模型名称 */
  aiModel: string;
  /** DeepSeek API 密钥 */
  deepseekApiKey: string;
}

const App: React.FC = () => {
  const { t } = useI18n();
  const [autoSkip, setAutoSkip] = useState<boolean>(DEFAULT_CONFIG.autoSkip);
  const [ignoreVideoLessThan5Minutes, setignoreVideoLessThan5Minutes] = useState<boolean>(DEFAULT_CONFIG.ignoreVideoLessThan5Minutes);
  const [ignoreVideoMoreThan30Minutes, setIgnoreVideoMoreThan30Minutes] = useState<boolean>(DEFAULT_CONFIG.ignoreVideoMoreThan30Minutes);

  useEffect(() => {
    const loadSettings = async () => {
      const result = await chrome.storage.local.get(['autoSkip', 'ignoreVideoLessThan5Minutes', 'ignoreVideoMoreThan30Minutes']);
      console.log("📺 ✔️ Loading settings:", result.autoSkip, result.ignoreVideoLessThan5Minutes, result.ignoreVideoMoreThan30Minutes);
      if (result.autoSkip !== undefined) {
        setAutoSkip(result.autoSkip);
      } else {
        await chrome.storage.local.set({ autoSkip: DEFAULT_CONFIG.autoSkip });
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
  }, []);

  const showSuccessNotification = (message: string) => {
    notifications.show({
      title: t('saved'),
      message: message,
      color: 'green',
      position: 'top-right',
    });
  }

  const updateAutoSkip = async (value: boolean) => {
    setAutoSkip(value);
    await chrome.storage.local.set({ autoSkip: value });
    showSuccessNotification(t('refreshToApply'));
  }

  const updateignoreVideoLessThan5Minutes = async (value: boolean) => {
    setignoreVideoLessThan5Minutes(value);
    await chrome.storage.local.set({ ignoreVideoLessThan5Minutes: value });
    showSuccessNotification(t('refreshToApply'));
  }

  const updateIgnoreVideoMoreThan30Minutes = async (value: boolean) => {
    setIgnoreVideoMoreThan30Minutes(value);
    await chrome.storage.local.set({ ignoreVideoMoreThan30Minutes: value });
    showSuccessNotification(t('refreshToApply'));
  }

  const form = useForm<ConfigForm>({
    mode: 'uncontrolled',
    initialValues: {
      aiModel: DEFAULT_CONFIG.aiModel,
      deepseekApiKey: DEFAULT_CONFIG.deepseekApiKey,
    },
  });

  useEffect(() => {
    const loadFormData = async () => {
      const result = await chrome.storage.local.get(['aiModel', 'deepseekApiKey']);

      form.setValues({
        aiModel: result.aiModel || DEFAULT_CONFIG.aiModel,
        deepseekApiKey: result.deepseekApiKey || DEFAULT_CONFIG.deepseekApiKey,
      });
      form.resetDirty();
    };

    loadFormData();
  }, []);

  const handleSubmit = async (values: ConfigForm) => {
    console.log('Saving config:', values);
    await chrome.storage.local.set({
      aiModel: values.aiModel,
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
                  {...form.getInputProps('aiModel')}
                  key={form.key('aiModel')}
                  label={t('aiModel')}
                  placeholder="Pick value"
                  maxDropdownHeight={100}
                  searchable
                  size="xs"
                  data={[
                    {
                      group: 'DeepSeek',
                      items: [
                        { value: 'deepseek-chat', label: 'deepseek-chat' },
                        { value: 'deepseek-reasoner', label: 'deepseek-reasoner' },
                      ],
                    },
                  ]}
                />
                <PasswordInput
                  label="DeepSeek API Key"
                  placeholder={t('enterApiKey')}
                  {...form.getInputProps('deepseekApiKey')}
                  size="xs"
                />
              </div>
              <Group justify="flex-end" mt="sm" gap="xs">
                <Button type="submit" size="xs" disabled={!form.isDirty()}>
                  {t('save')}
                </Button>
              </Group>
            </Stack>
          </form>
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
