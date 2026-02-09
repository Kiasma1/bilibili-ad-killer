import { BilibiliSubtitle, SubtitleString } from './types';

/**
 * 将字幕对象数组转换为格式化字符串
 * @param subtitles - B 站字幕条目数组
 * @returns 格式为 "[开始时间-结束时间]:内容" 的字符串，多条用分号连接
 */
export function convertSubtitleObjToStr(subtitles: BilibiliSubtitle[]): string {
    return subtitles.map((sub: BilibiliSubtitle) => {
        const { from, to, content } = sub;
        const subtitleStr: SubtitleString = `[${from}-${to}]:${content}`;
        return subtitleStr;
    }).join(';');
}

/**
 * 从当前页面 URL 中提取视频 BV 号
 * @returns BV 号字符串，如果不在视频页面则返回 null
 */
export function getVideoIdFromCurrentPage(): string | null {
    const match = window.location.pathname.match(/\/video\/(BV\w+)/);
    return match ? match[1] : null;
}
