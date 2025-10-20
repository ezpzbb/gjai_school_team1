import express from 'express';
import { Request, Response } from 'express';

const router = express.Router();

// 🔍 CCTV 위치 데이터 API
router.get('/locations', (req: Request, res: Response) => {
  try {
    // 테스트용 CCTV 데이터 반환
    const cctvData = [
      {
        id: 'cctv_001',
        lat: 37.5665,
        lng: 126.9780,
        videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        name: '서울시청 앞'
      },
      {
        id: 'cctv_002',
        lat: 37.5700,
        lng: 126.9769,
        videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        name: '광화문 광장'
      },
      {
        id: 'cctv_003',
        lat: 37.5620,
        lng: 126.9830,
        videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        name: '명동 거리'
      }
    ];

    // 성공 응답 형식
    res.json({
      success: true,
      data: cctvData,
      count: cctvData.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'CCTV 데이터 처리 중 오류 발생'
    });
  }
});

export default router;