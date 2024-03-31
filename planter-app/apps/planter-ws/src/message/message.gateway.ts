import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Buffer } from 'buffer';
import { IncomingMessage } from 'http';
import WebSocket, { Server } from 'ws';
import { smileys } from './smileys';


interface MessagePayload {
  readonly message: string;
}

interface AckPayload {
  readonly message: string;
}

interface TriggerPayload {
  readonly cid: string;
  readonly images: string[];
  readonly delay: number;
}

interface PushPayload {
  readonly cid: string;
  readonly data: string;
}

interface ImagePayload {
  readonly image: string;
  readonly ic: number;
  readonly ir: number;
}

interface ReturnMessagePayload {
  readonly event: string;
  readonly data: MessagePayload | ImagePayload;
}

@WebSocketGateway({ path: '/ws' })
export class MessageGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private clients = new Map<WebSocket, string>();

  handleDisconnect(client: WebSocket) {
    const id = this.clients.get(client);
    this.clients.delete(client);
    console.log('Client disconnected', { id });
  }

  handleConnection(client: WebSocket, incomingMessage: IncomingMessage): void {
    const id = this.getSecWebSocketKey(incomingMessage);
    try {
      const { username, password } = this.parseBasicAuth(this.getAuth(incomingMessage));
      if (username !== process.env['WS_USERNAME'] || password !== process.env['WS_PASSWORD']) {
        client.terminate();
        console.log('Client invalid', { id, username, password });
      } else {
        this.clients.set(client, id);
        console.log('Client connected', { id, ip: (client as any)._socket.remoteAddress });
      }
    } catch (e) {
      console.error(e);
      client.terminate();
    }
  }

  parseBasicAuth(auth: string) {
    try {
      const encoded = auth.split(' ')[1];
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const [username, password] = decoded.split(':');
      return { username, password };
    } catch (e) {
      throw new Error('Invalid authorization header');
    }
  }

  getAuth(incomingMessage: IncomingMessage) {
    const header = incomingMessage.headers['authorization'];
    if (!header) {
      throw new Error('Authorization header not found');
    }

    return header;
  }

  @SubscribeMessage('trigger')
  handleTrigger(client: WebSocket, payload: TriggerPayload): ReturnMessagePayload {
    const id = this.clients.get(client);
    const targetClient = Array.from(this.clients.entries()).find((v) => v[1] === payload.cid);
    if (targetClient) {
      console.log(`Sending images to client ${targetClient[0]}...`)
      targetClient[0].send(JSON.stringify(
        {
          event: "image",
          data: {
            image: Buffer.from(payload.images.map(i => smileys[i]).join('')).toString('base64'),
            ic: payload.images.length,
            ir: payload.delay
          }
        }
      ));
    }
    return {
      event: 'message',
      data: {
        message: `You are ${id}. Sending message to client ${payload.cid} ${targetClient ? 'done' : 'failed'}.`
      }
    };
  }

  @SubscribeMessage('push')
  handlePush(client: WebSocket, payload: PushPayload): ReturnMessagePayload {
    const id = this.clients.get(client);
    const targetClient = Array.from(this.clients.entries()).find((v) => v[1] === payload.cid);
    if (targetClient) {
      console.log(`Sending data to client ${targetClient[0]}...`)
      targetClient[0].send(payload.data);
    }
    return {
      event: 'message',
      data: {
        message: `You are ${id}. Sending message to client ${payload.cid} ${targetClient ? 'done' : 'failed'}.`
      }
    };
  }

  @SubscribeMessage('ack')
  handleAck(client: WebSocket, payload: AckPayload): void {
    const id = this.clients.get(client);
    console.log(`Received ack from client ${id}: ${payload.message}`);
  }

  private getSecWebSocketKey(incomingMessage: IncomingMessage): string {
    const header = incomingMessage.headers['sec-websocket-key'];
    if (!header) {
      throw new Error('Sec-WebSocket-Key header not found');
    }

    return header;
  }
}
