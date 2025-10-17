import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { User, UserRegisterInput, UserLoginInput, UserAuthResponse } from '../models/User/UserModel';
import { UserModel } from '../models/User/UserModel';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../utils/jwt';

export class UserServices {
  static async register(input: UserRegisterInput): Promise<UserAuthResponse> {
    // 중복 체크
    const existingUsername = await UserModel.findUserByUsername(input.username);
    if (existingUsername) {
      throw new Error('Username already exists');
    }

    const existingEmail = await UserModel.findUserByEmail(input.email);
    if (existingEmail) {
      throw new Error('Email already exists');
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(input.password, 10);

    // 사용자 생성
    const userId = await UserModel.createUser(input.username, hashedPassword, input.email);

    // JWT 토큰 생성
    const token = jwt.sign(
      { user_id: userId, username: input.username, email: input.email },
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN } as SignOptions
    );

    return {
      token,
      user: {
        user_id: userId,
        username: input.username,
        email: input.email,
      },
    };
  }

  static async login(input: UserLoginInput): Promise<UserAuthResponse> {
    const user = await UserModel.findUserByIdentifier(input.identifier);
    if (!user) {
      throw new Error('Invalid identifier or password');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid identifier or password');
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, email: user.email },
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN } as SignOptions
    );

    return {
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
      },
    };
  }
}