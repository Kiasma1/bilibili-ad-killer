import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications, notifications } from '@mantine/notifications';
import { TextInput, Button, Stack, Group, Table, Badge, Text, ActionIcon, Title, Paper } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

interface UserKeyword {
    keyword: string;
    source: 'builtin' | 'ai' | 'user';
    createdAt: number;
}

const BUILTIN_KEYWORDS: string[] = [
    '感谢', '赞助', '链接', '下单', '折扣', '领券',
    '金主爸爸', '点击下方', '简介区', '防不胜防',
    '恰饭', '推广', '广告', '甚至还有',
];

const USER_KEYWORDS_KEY = 'USER_KEYWORDS';

const sourceBadge = (source: UserKeyword['source']) => {
    switch (source) {
        case 'builtin': return <Badge color="gray" size="sm">内置</Badge>;
        case 'ai': return <Badge color="blue" size="sm">AI 学习</Badge>;
        case 'user': return <Badge color="green" size="sm">手动添加</Badge>;
    }
};

const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const Options: React.FC = () => {
    const [userKeywords, setUserKeywords] = useState<UserKeyword[]>([]);
    const [newKeyword, setNewKeyword] = useState('');

    const loadKeywords = async () => {
        const result = await chrome.storage.local.get(USER_KEYWORDS_KEY);
        setUserKeywords(result[USER_KEYWORDS_KEY] || []);
    };

    useEffect(() => { loadKeywords(); }, []);

    const addKeyword = async () => {
        const trimmed = newKeyword.trim();
        if (!trimmed) return;
        if (BUILTIN_KEYWORDS.includes(trimmed) || userKeywords.some(k => k.keyword === trimmed)) {
            notifications.show({ title: '提示', message: `"${trimmed}" 已存在`, color: 'yellow' });
            return;
        }
        const updated = [...userKeywords, { keyword: trimmed, source: 'user' as const, createdAt: Date.now() }];
        await chrome.storage.local.set({ [USER_KEYWORDS_KEY]: updated });
        setUserKeywords(updated);
        setNewKeyword('');
        notifications.show({ title: '成功', message: `已添加 "${trimmed}"`, color: 'green' });
    };

    const deleteKeyword = async (keyword: string) => {
        const updated = userKeywords.filter(k => k.keyword !== keyword);
        await chrome.storage.local.set({ [USER_KEYWORDS_KEY]: updated });
        setUserKeywords(updated);
        notifications.show({ title: '已删除', message: `"${keyword}" 已移除`, color: 'red' });
    };

    const clearAll = async () => {
        await chrome.storage.local.set({ [USER_KEYWORDS_KEY]: [] });
        setUserKeywords([]);
        notifications.show({ title: '已清空', message: '所有用户词库已清空', color: 'red' });
    };

    const builtinRows = BUILTIN_KEYWORDS.map(kw => (
        <Table.Tr key={`builtin-${kw}`}>
            <Table.Td>{kw}</Table.Td>
            <Table.Td>{sourceBadge('builtin')}</Table.Td>
            <Table.Td>—</Table.Td>
            <Table.Td></Table.Td>
        </Table.Tr>
    ));

    const userRows = userKeywords.map(kw => (
        <Table.Tr key={`user-${kw.keyword}`}>
            <Table.Td>{kw.keyword}</Table.Td>
            <Table.Td>{sourceBadge(kw.source)}</Table.Td>
            <Table.Td>{formatDate(kw.createdAt)}</Table.Td>
            <Table.Td>
                <ActionIcon color="red" variant="subtle" size="sm" onClick={() => deleteKeyword(kw.keyword)}>
                    ✕
                </ActionIcon>
            </Table.Td>
        </Table.Tr>
    ));

    return (
        <Stack gap="lg">
            <Title order={3}>广告关键词管理</Title>
            <Paper shadow="xs" p="md" withBorder>
                <Group gap="sm">
                    <TextInput
                        placeholder="输入新关键词..."
                        value={newKeyword}
                        onChange={e => setNewKeyword(e.currentTarget.value)}
                        onKeyDown={e => e.key === 'Enter' && addKeyword()}
                        style={{ flex: 1 }}
                        size="sm"
                    />
                    <Button size="sm" onClick={addKeyword}>添加</Button>
                    {userKeywords.length > 0 && (
                        <Button size="sm" color="red" variant="light" onClick={clearAll}>清空用户词库</Button>
                    )}
                </Group>
            </Paper>
            <Paper shadow="xs" p="md" withBorder>
                <Text fw={600} mb="sm">词库列表 ({BUILTIN_KEYWORDS.length + userKeywords.length} 条)</Text>
                <Table striped highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>关键词</Table.Th>
                            <Table.Th>来源</Table.Th>
                            <Table.Th>创建时间</Table.Th>
                            <Table.Th>操作</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {builtinRows}
                        {userRows}
                    </Table.Tbody>
                </Table>
            </Paper>
        </Stack>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
    <React.StrictMode>
        <MantineProvider>
            <Notifications />
            <Options />
        </MantineProvider>
    </React.StrictMode>
);
