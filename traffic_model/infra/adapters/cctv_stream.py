import cv2


def _is_hls(u):
    return ".m3u8" in u or u.endswith("m3u8")


def _is_rtsp(u):
    return u.startswith("rtsp://")


class FrameStream:
    def __init__(self, source):
        self.source = source
        self.cap = None

    def _ensure(self):
        if self.cap is not None:
            return

        if _is_rtsp(self.source):
            print('in rtsp')
            self.cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)

        elif _is_hls(self.source):
            print('in hls')
            self.cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)

        else:
            print('anther...')
            self.cap = cv2.VideoCapture(self.source)

    def read_one(self):
        self._ensure()
        ok, frame = self.cap.read()
        if not ok:
            return None
        return frame

    def __del__(self):
        try:
            if self.cap is not None:
                self.cap.release()
        except:
            pass
