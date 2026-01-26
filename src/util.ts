export type subtitle = {
    from: number,
    to: number,
    content: string,
}

type SubtitleString = `[${string}-${string}]:${string}`;

export function convertSubtitleObjToStr(subtitles: subtitle[]): string {
    return subtitles.map((sub: subtitle) => {
        const { from, to, content } = sub
        const subtitleStr: SubtitleString = `[${from}-${to}]:${content}`;
        return subtitleStr;
    }).join(';')
}

export function getVideoIdFromCurrentPage() {
    const match = window.location.pathname.match(/\/video\/(BV\w+)/);
    return match ? match[1] : null;
}
