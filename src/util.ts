import { Subtitle, SubtitleString } from './types';

export function convertSubtitleObjToStr(subtitles: Subtitle[]): string {
    return subtitles.map((sub: Subtitle) => {
        const { from, to, content } = sub;
        const subtitleStr: SubtitleString = `[${from}-${to}]:${content}`;
        return subtitleStr;
    }).join(';');
}

export function getVideoIdFromCurrentPage(): string | null {
    const match = window.location.pathname.match(/\/video\/(BV\w+)/);
    return match ? match[1] : null;
}
