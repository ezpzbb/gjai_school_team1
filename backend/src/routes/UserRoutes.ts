// 인증 관련 API 라우트 정의

import express from 'express';
import { UserServices } from '../services/UserService';
import { authenticateJWT } from '../middlewares/User';

const router = express.Router();

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    const result = await UserServices.register({ username, password, email });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const result = await UserServices.login({ identifier, password });
    res.status(200).json(result);
  } catch (error: any) {
    res.status(401).json({ message: error.message });
  }
});

// 프로필 (테스트용 보호된 라우트)
router.get('/profile', authenticateJWT, (req, res) => {
  res.json({ message: 'User profile accessed', user: req.user });
});

export default router;