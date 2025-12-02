# 영상 보정 작업(날씨에 따라 cctv 영상 보정)

import cv2
import numpy as np


def enhance_frame(img):
    # 야간/악천후 대비 간단 강화: 밝기 보정 + 샤픈 + 히스토그램 균등화(컬러보존 CLAHE)
    if img is None:
        return img

    # 감마 보정(어두운 영상 밝히기)
    gamma = 1.2
    look = np.empty((1, 256), np.uint8)
    for i in range(256):
        look[0, i] = np.clip(pow(i / 255.0, 1.0/gamma) * 255.0, 0, 255)
    img = cv2.LUT(img, look)

    # CLAHE in LAB
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l2 = clahe.apply(l)
    lab2 = cv2.merge((l2, a, b))
    img = cv2.cvtColor(lab2, cv2.COLOR_LAB2BGR)

    # 약한 샤프닝
    blur = cv2.GaussianBlur(img, (0, 0), 1.0)
    img = cv2.addWeighted(img, 1.5, blur, -0.5, 0)
    return img
