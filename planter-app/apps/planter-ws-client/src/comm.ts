import { MqttClient } from "mqtt/*";
import { fetchRandomImage } from "./image.downloader";

export interface CommParams {
    readonly mqtt: MqttClient;
    readonly clientId: string;
    readonly imageWidth: number;
    readonly chunkSize?: number;
}

export class Comm {
    public imageWidth: number;

    public clientId: string;
    private mqttClient: MqttClient;
    private fileBuffer?: Buffer;
    private chunkSize: number;

    private previousChunk = 0;
    private totalChunks?: number;

    private searchTerm = 'chosen';
    private timeout?: NodeJS.Timeout;

    constructor(params: CommParams) {
        this.mqttClient = params.mqtt;
        this.clientId = params.clientId;
        this.imageWidth = params.imageWidth;
        this.chunkSize = params.chunkSize || 8000;
    }

    beginImage = (searchTerm: string) => {
        this.searchTerm = searchTerm;
        if (!this.timeout) {
            this.timeout = setTimeout(async () => {
                const buffer = await fetchRandomImage(this.imageWidth, this.searchTerm, this.clientId === 'e9f29e748' ? 200000 : undefined);
                if (buffer) {
                    console.log('Sending image to client', this.clientId);
                    this.send(buffer);
                } else {
                    console.log('Failed to download image');
                }
            }, 30000);
        } else {
            this.timeout.refresh();
        }
    }

    send = (fileBuffer: Buffer) => {
        console.log('Sending file to', this.clientId, 'with', fileBuffer.length, 'bytes');
        this.fileBuffer = fileBuffer;
        this.totalChunks = Math.ceil(this.fileBuffer.length / this.chunkSize);
        this.resend();
    }

    resend = () => {
        if (!this.fileBuffer) {
            throw new Error('No file buffer to send');
        }
        this.previousChunk = 0;
        this.mqttClient.publish(`filestart/${this.clientId}`, "start", { qos: 2 });

        setTimeout(() => this.nextChunk(), 500);
    }

    ack = (ackChunk: number): boolean => {
        if (ackChunk === this.previousChunk) {
            this.previousChunk++;
            console.log('Received ack from', this.clientId, 'for chunk', this.previousChunk);
            return true;
        }
        else {
            console.log('Received ack from', this.clientId, 'for chunk', ackChunk, 'but expected', this.previousChunk);
            return true;
        }
    }

    nextChunk = () => {
        if (!this.fileBuffer || !this.totalChunks) {
            throw new Error('No file buffer to send');
        }
        if (this.previousChunk >= this.totalChunks) {
            console.log('All chunks sent to', this.clientId)
            this.mqttClient.publish(`filedone/${this.clientId}`, 'done', { qos: 2 });
        } else {
            console.log('Sending next chunk to', this.clientId, 'chunk', this.previousChunk + 1, 'of', this.totalChunks)
            const chunk = this.fileBuffer.subarray(this.previousChunk * this.chunkSize, (this.previousChunk + 1) * this.chunkSize);
            this.mqttClient.publish(`file/${this.clientId}`, chunk, { qos: 2 });
        }
    }

    restart = () => {
        this.mqttClient.publish(`restart/${this.clientId}`, "", { qos: 2 });
    }
}
