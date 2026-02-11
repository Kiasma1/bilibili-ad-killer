/**
 * 从当前页面 URL 中提取视频 BV 号
 * @returns BV 号字符串，如果不在视频页面则返回 null
 */
export function getVideoIdFromCurrentPage(): string | null {
    const match = window.location.pathname.match(/\/video\/(BV\w+)/);
    return match ? match[1] : null;
}
