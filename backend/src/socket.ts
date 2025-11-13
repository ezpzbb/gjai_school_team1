import { Server as SocketIOServer } from 'socket.io';
import { updateEventData, setEventUpdateCallback, getEvents, EventItem } from './eventUpdater';

// 이벤트 룸 이름
const EVENT_ROOM = 'events';

/**
 * Socket.IO 이벤트 핸들러 설정
 */
export function setupSocketHandlers(io: SocketIOServer): void {
  console.log('Socket.IO 이벤트 핸들러 설정 완료');

  // 이벤트 업데이트 시 클라이언트에 전송
  setEventUpdateCallback((events: EventItem[]) => {
    io.to(EVENT_ROOM).emit('event-update', events);
    console.log(`이벤트 업데이트 전송: ${events.length}개`);
  });

  io.on('connection', (socket) => {
    console.log(`클라이언트 연결됨: ${socket.id}`);

    // 이벤트 룸 입장
    socket.on('join-events', () => {
      socket.join(EVENT_ROOM);
      console.log(`클라이언트 ${socket.id}가 이벤트 룸에 입장했습니다.`);
      
      // 즉시 현재 이벤트 목록 전송
      const events = getEvents();
      socket.emit('event-update', events);
      console.log(`현재 이벤트 ${events.length}개 전송`);
    });

    // 이벤트 룸 퇴장
    socket.on('leave-events', () => {
      socket.leave(EVENT_ROOM);
      console.log(`클라이언트 ${socket.id}가 이벤트 룸에서 퇴장했습니다.`);
    });

    // 기존 룸 관련 이벤트 (호환성 유지)
    socket.on('join-room', (room: string) => {
      socket.join(room);
      console.log(`클라이언트 ${socket.id}가 방 ${room}에 입장했습니다.`);
    });

    socket.on('leave-room', (room: string) => {
      socket.leave(room);
      console.log(`클라이언트 ${socket.id}가 방 ${room}에서 퇴장했습니다.`);
    });

    socket.on('disconnect', () => {
      console.log(`클라이언트 연결 해제됨: ${socket.id}`);
    });
  });
}
