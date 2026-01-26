import { identifyAdTimeRangeByGeminiAI } from "../../ai.js"
import { convertSubtitleObjToStr } from "../../util.js"

import { GoogleGenAI } from '@google/genai';
import { readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const apiKey = process.env.GOOGLE_GEMINI_API_KEY
const geminiClient = new GoogleGenAI({ apiKey });

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const subtitleFilesDir = join(__dirname)
const file = 'sample.json'
const filePath = join(subtitleFilesDir, file)
const fileContent = readFileSync(filePath, 'utf-8');
const subStr = convertSubtitleObjToStr(JSON.parse(fileContent).body)

console.log(subStr)
const responseSchema = {
    type: 'OBJECT',
    properties: {
        startTime: {type: 'number', nullable: false},
        endTime: {type: 'number', nullable: false},
    },
    required: ['startTime', 'endTime'],
};

async function main() {
    const response = await geminiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
            responseJsonSchema: responseSchema,
            responseMimeType: "application/json",
            httpOptions: {
                timeout: 1000 * 60,
            }
        },
        contents: `
        接下我会分享给你一段视频字幕，该段字幕由多个字幕语句组成。
        每一句字幕包含三部分内容，分别是起始时间，结束时间，以及字幕内容，格式如下：[{起始时间}-{结束时间}]:{字幕内容}。语句之间由分号（;）隔开。
            
        帮助我分析其中哪些是英文内容，给出其中连续英文内容起始时间和终止时间
        
        如果存在英文内容，请将起止时间返回给我
        如果不存在英文内容，返回null
        
        字幕内容如下：
                    ------
                    ${subStr}
                    `,
    })
    console.log(response.text)
}

main()






