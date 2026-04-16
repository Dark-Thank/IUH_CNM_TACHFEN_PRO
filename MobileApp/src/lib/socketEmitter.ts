import type { Socket } from "socket.io-client";

type SocketGetter = () => Socket | null;

let getSocket: SocketGetter = () => null;

export const socketEmitter = {
  setSocketGetter: (getter: SocketGetter) => {
    getSocket = getter;
  },

  emit: (event: string, ...args: unknown[]) => {
    getSocket()?.emit(event, ...args);
  },
};
