import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { SELECTORS } from '../constants';

const progressWrapClassSelector = SELECTORS.PROGRESS_BAR;
const playerContainerSelector = SELECTORS.PLAYER_CONTAINER;
const playWrapId = SELECTORS.PLAYER_WRAP_ID;

describe('DOM 依赖契约测试 — 验证 B 站页面上扩展所需的 DOM 元素是否存在', () => {
  let browser: Browser;
  let page: Page;
  const TEST_VIDEO_URL = 'https://www.bilibili.com/video/BV1xx411c7mu'; // A sample Bilibili video URL
  const WAIT_TIME_MS = 30000; // 30 seconds as requested

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true, // Set to true if you want headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    
    // Set a reasonable viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the video page
    console.log(`Navigating to ${TEST_VIDEO_URL}...`);
    await page.goto(TEST_VIDEO_URL, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // Wait at least 30 seconds for DOM to fully render
    console.log(`Waiting ${WAIT_TIME_MS / 1000} seconds for DOM to render...`);
    await new Promise(resolve => setTimeout(resolve, WAIT_TIME_MS));
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('inject.ts 所需的 DOM 依赖', () => {
    it('document.body 应该存在', async () => {
      const bodyExists = await page.evaluate(() => {
        return !!document.body;
      });
      expect(bodyExists).toBe(true);
    });

    it('window.__INITIAL_STATE__.videoData.title 应该存在', async () => {
      const hasVideoTitle = await page.evaluate(() => {
        // @ts-ignore
        return !!(window.__INITIAL_STATE__?.videoData?.title);
      });
      expect(hasVideoTitle).toBe(true);
    });

    it('window.__INITIAL_STATE__.videoData.desc 应该存在', async () => {
      const hasVideoDesc = await page.evaluate(() => {
        // @ts-ignore
        return !!(window.__INITIAL_STATE__?.videoData?.desc);
      });
      expect(hasVideoDesc).toBe(true);
    });

    it('window.__INITIAL_STATE__.videoData.duration 应该存在', async () => {
      const hasVideoDuration = await page.evaluate(() => {
        // @ts-ignore
        const duration = (window as any).__INITIAL_STATE__?.videoData?.duration;
        return duration !== undefined && duration !== null;
      });
      expect(hasVideoDuration).toBe(true);
    });

    it('当前页面路径应以 /video/ 开头', async () => {
      const isVideoPage = await page.evaluate(() => {
        return window.location.pathname.startsWith('/video/');
      });
      expect(isVideoPage).toBe(true);
    });

    it('应能从 URL 路径中提取视频 BV 号', async () => {
      const videoId = await page.evaluate(() => {
        const match = window.location.pathname.match(/\/video\/(BV\w+)/);
        return match ? match[1] : null;
      });
      expect(videoId).toBeTruthy();
      expect(videoId).toMatch(/^BV\w+$/);
    });
  });

  describe('bilibili-ui.ts 所需的 DOM 依赖', () => {
    it('应存在 .bpx-player-progress-schedule 进度条元素', async () => {
      const progressScheduleExists = await page.evaluate((selector) => {
        return !!document.querySelector(selector);
      }, progressWrapClassSelector);
      expect(progressScheduleExists).toBe(true);
    });

    it('应存在 #playerWrap 播放器包裹元素', async () => {
      const playerWrapExists = await page.evaluate((id) => {
        return !!document.getElementById(id);
      }, playWrapId);
      expect(playerWrapExists).toBe(true);
    });

    it('应存在 .bpx-player-container 播放器容器元素', async () => {
      const playerContainerExists = await page.evaluate((selector) => {
        return !!document.querySelector(selector);
      }, playerContainerSelector);
      expect(playerContainerExists).toBe(true);
    });

    it('应存在 video 视频元素', async () => {
      const videoExists = await page.evaluate(() => {
        return !!document.querySelector('video');
      });
      expect(videoExists).toBe(true);
    });

    it('video 元素应有有效的 duration 属性', async () => {
      const videoHasDuration = await page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        return video && !isNaN(video.duration) && video.duration > 0;
      });
      expect(videoHasDuration).toBe(true);
    });

    it('document.head 应该存在（用于注入样式）', async () => {
      const headExists = await page.evaluate(() => {
        return !!document.head;
      });
      expect(headExists).toBe(true);
    });

    it('进度条元素应有大于 0 的宽度', async () => {
      const progressWrapWidth = await page.evaluate((selector) => {
        const progressWrap = document.querySelector(selector) as HTMLElement;
        return progressWrap ? progressWrap.offsetWidth : 0;
      }, progressWrapClassSelector);
      expect(progressWrapWidth).toBeGreaterThan(0);
    });

    it('video 元素的 readyState 应 >= 2（可播放状态）', async () => {
      const videoReady = await page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        return video && video.readyState >= 2;
      });
      expect(videoReady).toBe(true);
    });
  });

  describe('集成测试：所有关键 DOM 依赖应同时可用', () => {
    it('所有关键 DOM 元素应同时存在', async () => {
      const allDependenciesExist = await page.evaluate((selectors) => {
        const video = document.querySelector('video') as HTMLVideoElement;
        
        const checks: Record<string, boolean> = {
          body: !!document.body,
          head: !!document.head,
          progressSchedule: !!document.querySelector(selectors.progressWrap),
          playerWrap: !!document.getElementById(selectors.playWrapId),
          playerContainer: !!document.querySelector(selectors.playerContainer),
          video: !!document.querySelector('video'),
          videoData: !!(window as any).__INITIAL_STATE__?.videoData,
          videoTitle: !!(window as any).__INITIAL_STATE__?.videoData?.title,
          videoDesc: !!(window as any).__INITIAL_STATE__?.videoData?.desc,
          videoDuration: (window as any).__INITIAL_STATE__?.videoData?.duration !== undefined,
          isVideoPage: window.location.pathname.startsWith('/video/'),
          videoHasDuration: video && !isNaN(video.duration) && video.duration > 0,
          videoReady: video && video.readyState >= 2,
        };

        return checks;
      }, {
        progressWrap: progressWrapClassSelector,
        playWrapId: playWrapId,
        playerContainer: playerContainerSelector,
      });

      expect(allDependenciesExist.body).toBe(true);
      expect(allDependenciesExist.head).toBe(true);
      expect(allDependenciesExist.progressSchedule).toBe(true);
      expect(allDependenciesExist.playerWrap).toBe(true);
      expect(allDependenciesExist.playerContainer).toBe(true);
      expect(allDependenciesExist.video).toBe(true);
      expect(allDependenciesExist.videoData).toBe(true);
      expect(allDependenciesExist.videoTitle).toBe(true);
      expect(allDependenciesExist.videoDesc).toBe(true);
      expect(allDependenciesExist.videoDuration).toBe(true);
      expect(allDependenciesExist.isVideoPage).toBe(true);
      expect(allDependenciesExist.videoHasDuration).toBe(true);
      expect(allDependenciesExist.videoReady).toBe(true);
    });
  });
});
