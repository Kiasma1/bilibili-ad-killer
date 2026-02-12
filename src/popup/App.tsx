import React, { useState, useEffect, useRef } from 'react';
import { Switch, Select, PasswordInput, Button, Stack, Group, Divider, Text, TextInput, NumberInput, Badge, ActionIcon, ScrollArea, Tooltip } from '@mantine/core';
import { Tabs } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useI18n } from '../hooks/useI18n';
import { DEFAULT_CONFIG } from '../config';
import { BUILTIN_KEYWORDS } from '../services/keyword-filter';
import './App.css';

/** 配置表单的数据结构 */
interface ConfigForm {
  /** AI 模型名称 */
  aiModel: string;
  /** DeepSeek API 密钥 */
  deepseekApiKey: string;
}

interface UserKeyword {
  keyword: string;
  source: 'builtin' | 'ai' | 'user';
  createdAt: number;
}

const USER_KEYWORDS_KEY = 'USER_KEYWORDS';
const DISABLED_BUILTIN_KEY = 'DISABLED_BUILTIN_KEYWORDS';
const CURRENT_SUBTITLES_KEY = 'CURRENT_SUBTITLES';
const DETECTION_STATS_KEY = 'DETECTION_STATS';
const AD_TIME_RANGE_CACHE_KEY = 'AD_TIME_RANGE_CACHE';

interface SubtitleEntry {
  from: number;
  to: number;
  content: string;
}

interface DetectionStats {
  totalScanned: number;
  adsFound: number;
  adsSkippedSeconds: number;
  manualMarks: number;
}

const App: React.FC = () => {
  const { t } = useI18n();
  const [autoSkip, setAutoSkip] = useState<boolean>(DEFAULT_CONFIG.autoSkip);
  const [ignoreVideoLessThan5Minutes, setignoreVideoLessThan5Minutes] = useState<boolean>(DEFAULT_CONFIG.ignoreVideoLessThan5Minutes);
  const [ignoreVideoMoreThan30Minutes, setIgnoreVideoMoreThan30Minutes] = useState<boolean>(DEFAULT_CONFIG.ignoreVideoMoreThan30Minutes);

  // Keywords state
  const [userKeywords, setUserKeywords] = useState<UserKeyword[]>([]);
  const [disabledBuiltin, setDisabledBuiltin] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingIsBuiltin, setEditingIsBuiltin] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Transcript state
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [subtitleVideoId, setSubtitleVideoId] = useState<string>('');

  // Stats state
  const [stats, setStats] = useState<DetectionStats>({ totalScanned: 0, adsFound: 0, adsSkippedSeconds: 0, manualMarks: 0 });
  const [manualStart, setManualStart] = useState<number | string>('');
  const [manualEnd, setManualEnd] = useState<number | string>('');

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

  // ---- Keywords logic ----

  const loadKeywords = async () => {
    const result = await chrome.storage.local.get([USER_KEYWORDS_KEY, DISABLED_BUILTIN_KEY]);
    setUserKeywords(result[USER_KEYWORDS_KEY] || []);
    setDisabledBuiltin(result[DISABLED_BUILTIN_KEY] || []);
  };

  useEffect(() => { loadKeywords(); }, []);

  // ---- Transcript logic ----

  useEffect(() => {
    const loadSubtitles = async () => {
      const result = await chrome.storage.local.get(CURRENT_SUBTITLES_KEY);
      const data = result[CURRENT_SUBTITLES_KEY];
      if (data) {
        setSubtitles(data.subtitles || []);
        setSubtitleVideoId(data.videoId || '');
      }
    };
    loadSubtitles();
  }, []);

  // ---- Stats logic ----

  useEffect(() => {
    const loadStats = async () => {
      const result = await chrome.storage.local.get(DETECTION_STATS_KEY);
      if (result[DETECTION_STATS_KEY]) setStats(result[DETECTION_STATS_KEY]);
    };
    loadStats();
  }, []);

  const resetStats = async () => {
    const empty: DetectionStats = { totalScanned: 0, adsFound: 0, adsSkippedSeconds: 0, manualMarks: 0 };
    await chrome.storage.local.set({ [DETECTION_STATS_KEY]: empty });
    setStats(empty);
    notifications.show({ title: t('statsResetDone'), message: '', color: 'green', position: 'top-right' });
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const applyManualAd = async () => {
    const start = Number(manualStart);
    const end = Number(manualEnd);
    if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
      notifications.show({ title: t('manualAdInvalid'), message: '', color: 'red', position: 'top-right' });
      return;
    }
    // Get current video ID from stored subtitles (best available source in popup)
    const result = await chrome.storage.local.get(CURRENT_SUBTITLES_KEY);
    const videoId = result[CURRENT_SUBTITLES_KEY]?.videoId;
    if (!videoId) {
      notifications.show({ title: t('manualAdInvalid'), message: 'No video', color: 'red', position: 'top-right' });
      return;
    }
    // Save to cache via content script
    const cache = (await chrome.storage.local.get(AD_TIME_RANGE_CACHE_KEY))[AD_TIME_RANGE_CACHE_KEY] || {};
    await chrome.storage.local.set({
      [AD_TIME_RANGE_CACHE_KEY]: { ...cache, [videoId]: { startTime: start, endTime: end, createAt: Date.now() } },
    });
    // Update stats
    const adDuration = end - start;
    const newStats = { ...stats, manualMarks: stats.manualMarks + 1, adsFound: stats.adsFound + 1, adsSkippedSeconds: stats.adsSkippedSeconds + adDuration };
    await chrome.storage.local.set({ [DETECTION_STATS_KEY]: newStats });
    setStats(newStats);
    setManualStart('');
    setManualEnd('');
    notifications.show({ title: t('manualAdApplied'), message: `${start}s → ${end}s`, color: 'green', position: 'top-right' });
  };

  const clearManualAd = async () => {
    const result = await chrome.storage.local.get(CURRENT_SUBTITLES_KEY);
    const videoId = result[CURRENT_SUBTITLES_KEY]?.videoId;
    if (!videoId) return;
    const cache = (await chrome.storage.local.get(AD_TIME_RANGE_CACHE_KEY))[AD_TIME_RANGE_CACHE_KEY] || {};
    delete cache[videoId];
    await chrome.storage.local.set({ [AD_TIME_RANGE_CACHE_KEY]: cache });
    notifications.show({ title: t('manualAdCleared'), message: '', color: 'green', position: 'top-right' });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const copyTranscript = async () => {
    const text = subtitles.map(s => `[${formatTime(s.from)}] ${s.content}`).join('\n');
    await navigator.clipboard.writeText(text);
    notifications.show({ title: t('transcriptCopied'), message: '', color: 'green', position: 'top-right' });
  };

  const activeBuiltinKeywords = BUILTIN_KEYWORDS.filter(k => !disabledBuiltin.includes(k));

  const addKeyword = async () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    if (BUILTIN_KEYWORDS.includes(trimmed) || userKeywords.some(k => k.keyword === trimmed)) {
      notifications.show({ title: t('keywordsExists'), message: `"${trimmed}"`, color: 'yellow', position: 'top-right' });
      return;
    }
    const updated = [...userKeywords, { keyword: trimmed, source: 'user' as const, createdAt: Date.now() }];
    await chrome.storage.local.set({ [USER_KEYWORDS_KEY]: updated });
    setUserKeywords(updated);
    setNewKeyword('');
    notifications.show({ title: t('keywordsAdded'), message: `"${trimmed}"`, color: 'green', position: 'top-right' });
  };

  const deleteUserKeyword = async (keyword: string) => {
    const updated = userKeywords.filter(k => k.keyword !== keyword);
    await chrome.storage.local.set({ [USER_KEYWORDS_KEY]: updated });
    setUserKeywords(updated);
    notifications.show({ title: t('keywordsDeleted'), message: `"${keyword}"`, color: 'red', position: 'top-right' });
  };

  const disableBuiltinKeyword = async (keyword: string) => {
    const updated = [...disabledBuiltin, keyword];
    await chrome.storage.local.set({ [DISABLED_BUILTIN_KEY]: updated });
    setDisabledBuiltin(updated);
    notifications.show({ title: t('keywordsDeleted'), message: `"${keyword}"`, color: 'red', position: 'top-right' });
  };

  const resetBuiltin = async () => {
    await chrome.storage.local.set({ [DISABLED_BUILTIN_KEY]: [] });
    setDisabledBuiltin([]);
    notifications.show({ title: t('keywordsBuiltinRestored'), message: '', color: 'green', position: 'top-right' });
  };

  const clearUserKeywords = async () => {
    await chrome.storage.local.set({ [USER_KEYWORDS_KEY]: [] });
    setUserKeywords([]);
    notifications.show({ title: t('keywordsCleared'), message: '', color: 'red', position: 'top-right' });
  };

  const startEditing = (keyword: string, isBuiltin: boolean = false) => {
    setEditingKey(keyword);
    setEditingValue(keyword);
    setEditingIsBuiltin(isBuiltin);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const confirmEdit = async () => {
    if (!editingKey) return;
    const trimmed = editingValue.trim();
    if (!trimmed || trimmed === editingKey) {
      setEditingKey(null);
      return;
    }
    const allExisting = [...BUILTIN_KEYWORDS.filter(k => k !== editingKey), ...userKeywords.map(k => k.keyword)];
    if (allExisting.includes(trimmed)) {
      notifications.show({ title: t('keywordsExists'), message: `"${trimmed}"`, color: 'yellow', position: 'top-right' });
      return;
    }

    if (editingIsBuiltin) {
      // Disable the original builtin keyword and add the new value as a user keyword
      const newDisabled = [...disabledBuiltin, editingKey];
      const newUserKws = [...userKeywords, { keyword: trimmed, source: 'user' as const, createdAt: Date.now() }];
      await chrome.storage.local.set({ [DISABLED_BUILTIN_KEY]: newDisabled, [USER_KEYWORDS_KEY]: newUserKws });
      setDisabledBuiltin(newDisabled);
      setUserKeywords(newUserKws);
    } else {
      const updated = userKeywords.map(k =>
        k.keyword === editingKey ? { ...k, keyword: trimmed } : k
      );
      await chrome.storage.local.set({ [USER_KEYWORDS_KEY]: updated });
      setUserKeywords(updated);
    }

    setEditingKey(null);
    notifications.show({ title: t('saved'), message: `"${editingKey}" → "${trimmed}"`, color: 'green', position: 'top-right' });
  };

  const sourceBadge = (source: string) => {
    switch (source) {
      case 'builtin': return <Badge color="gray" size="xs">{t('keywordsBuiltin')}</Badge>;
      case 'ai': return <Badge color="blue" size="xs">{t('keywordsAi')}</Badge>;
      case 'user': return <Badge color="green" size="xs">{t('keywordsUser')}</Badge>;
      default: return null;
    }
  };

  return (
    <Tabs defaultValue="config" styles={{ tabLabel: { fontSize: "13px" } }}>
      <Tabs.List>
        <Tabs.Tab value="config">
          {t('configTab')}
        </Tabs.Tab>
        <Tabs.Tab value="keywords">
          {t('keywordsTab')}
        </Tabs.Tab>
        <Tabs.Tab value="transcript">
          {t('transcriptTab')}
        </Tabs.Tab>
        <Tabs.Tab value="stats">
          {t('statsTab')}
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

      <Tabs.Panel value="keywords">
        <div style={{ padding: '12px' }}>
          <Stack gap="xs">
            <Group gap="xs">
              <TextInput
                placeholder={t('keywordsAddPlaceholder')}
                value={newKeyword}
                onChange={e => setNewKeyword(e.currentTarget.value)}
                onKeyDown={e => e.key === 'Enter' && addKeyword()}
                style={{ flex: 1 }}
                size="xs"
              />
              <Button size="xs" onClick={addKeyword}>{t('keywordsAdd')}</Button>
            </Group>
            <Group gap="xs">
              {disabledBuiltin.length > 0 && (
                <Button size="xs" variant="light" onClick={resetBuiltin}>{t('keywordsResetBuiltin')}</Button>
              )}
              {userKeywords.length > 0 && (
                <Button size="xs" color="red" variant="light" onClick={clearUserKeywords}>{t('keywordsClearUser')}</Button>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              {t('keywordsTotal')} ({activeBuiltinKeywords.length + userKeywords.length})
            </Text>
            <ScrollArea h={260}>
              <Stack gap={4}>
                {activeBuiltinKeywords.map(kw => (
                  <Group key={`b-${kw}`} gap="xs" justify="space-between" wrap="nowrap"
                    style={{ padding: '3px 6px', borderRadius: 4, background: 'var(--mantine-color-gray-0)' }}>
                    <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                      {sourceBadge('builtin')}
                      {editingKey === kw ? (
                        <TextInput
                          ref={editInputRef}
                          size="xs"
                          value={editingValue}
                          onChange={e => setEditingValue(e.currentTarget.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') confirmEdit();
                            if (e.key === 'Escape') setEditingKey(null);
                          }}
                          onBlur={confirmEdit}
                          style={{ flex: 1 }}
                          styles={{ input: { height: 22, minHeight: 22, fontSize: 12, padding: '0 6px' } }}
                        />
                      ) : (
                        <Tooltip label={t('keywordsClickToEdit')} openDelay={500} position="top">
                          <Text size="xs" truncate style={{ flex: 1, cursor: 'pointer' }}
                            onClick={() => startEditing(kw, true)}>
                            {kw}
                          </Text>
                        </Tooltip>
                      )}
                    </Group>
                    <ActionIcon color="red" variant="subtle" size="xs" onClick={() => disableBuiltinKeyword(kw)}>
                      ✕
                    </ActionIcon>
                  </Group>
                ))}
                {userKeywords.map(kw => (
                  <Group key={`u-${kw.keyword}`} gap="xs" justify="space-between" wrap="nowrap"
                    style={{ padding: '3px 6px', borderRadius: 4, background: 'var(--mantine-color-gray-0)' }}>
                    <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                      {sourceBadge(kw.source)}
                      {editingKey === kw.keyword ? (
                        <TextInput
                          ref={editInputRef}
                          size="xs"
                          value={editingValue}
                          onChange={e => setEditingValue(e.currentTarget.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') confirmEdit();
                            if (e.key === 'Escape') setEditingKey(null);
                          }}
                          onBlur={confirmEdit}
                          style={{ flex: 1 }}
                          styles={{ input: { height: 22, minHeight: 22, fontSize: 12, padding: '0 6px' } }}
                        />
                      ) : (
                        <Tooltip label={t('keywordsClickToEdit')} openDelay={500} position="top">
                          <Text size="xs" truncate style={{ flex: 1, cursor: 'pointer' }}
                            onClick={() => startEditing(kw.keyword)}>
                            {kw.keyword}
                          </Text>
                        </Tooltip>
                      )}
                    </Group>
                    <ActionIcon color="red" variant="subtle" size="xs" onClick={() => deleteUserKeyword(kw.keyword)}>
                      ✕
                    </ActionIcon>
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
          </Stack>
        </div>
      </Tabs.Panel>

      <Tabs.Panel value="transcript">
        <div style={{ padding: '12px' }}>
          <Stack gap="xs">
            {subtitles.length > 0 ? (
              <>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">{subtitleVideoId} ({subtitles.length})</Text>
                  <Button size="xs" variant="light" onClick={copyTranscript}>{t('transcriptCopy')}</Button>
                </Group>
                <ScrollArea h={300}>
                  <Stack gap={2}>
                    {subtitles.map((s, i) => (
                      <Group key={i} gap={6} wrap="nowrap" align="flex-start" style={{ padding: '2px 0' }}>
                        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', minWidth: 36 }}>{formatTime(s.from)}</Text>
                        <Text size="xs" style={{ lineHeight: 1.4 }}>{s.content}</Text>
                      </Group>
                    ))}
                  </Stack>
                </ScrollArea>
              </>
            ) : (
              <Text size="xs" c="dimmed" ta="center" py="xl">{t('transcriptEmpty')}</Text>
            )}
          </Stack>
        </div>
      </Tabs.Panel>

      <Tabs.Panel value="stats">
        <div style={{ padding: '12px' }}>
          <Stack gap="sm">
            <Divider size="xs" label={t('statsTab')} labelPosition="center" />
            <Group grow>
              <div className="stat-card">
                <Text size="xl" fw={700}>{stats.totalScanned}</Text>
                <Text size="xs" c="dimmed">{t('statsScanned')}</Text>
              </div>
              <div className="stat-card">
                <Text size="xl" fw={700}>{stats.adsFound}</Text>
                <Text size="xs" c="dimmed">{t('statsAdsFound')}</Text>
              </div>
            </Group>
            <Group grow>
              <div className="stat-card">
                <Text size="xl" fw={700}>{formatDuration(stats.adsSkippedSeconds)}</Text>
                <Text size="xs" c="dimmed">{t('statsTimeSaved')}</Text>
              </div>
              <div className="stat-card">
                <Text size="xl" fw={700}>{stats.manualMarks}</Text>
                <Text size="xs" c="dimmed">{t('statsManual')}</Text>
              </div>
            </Group>
            <Button size="xs" variant="light" color="red" onClick={resetStats}>{t('statsReset')}</Button>

            <Divider size="xs" label={t('manualAdTitle')} labelPosition="center" />
            <Group gap="xs">
              <NumberInput
                placeholder={t('manualAdStart')}
                value={manualStart}
                onChange={setManualStart}
                size="xs"
                min={0}
                style={{ flex: 1 }}
                hideControls
              />
              <NumberInput
                placeholder={t('manualAdEnd')}
                value={manualEnd}
                onChange={setManualEnd}
                size="xs"
                min={0}
                style={{ flex: 1 }}
                hideControls
              />
            </Group>
            <Group gap="xs">
              <Button size="xs" onClick={applyManualAd} style={{ flex: 1 }}>{t('manualAdApply')}</Button>
              <Button size="xs" variant="light" color="red" onClick={clearManualAd} style={{ flex: 1 }}>{t('manualAdClear')}</Button>
            </Group>
          </Stack>
        </div>
      </Tabs.Panel>

    </Tabs>
  );
};

export default App;
