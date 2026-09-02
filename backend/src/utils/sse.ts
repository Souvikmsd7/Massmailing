import { Response } from 'express';

interface SseClient {
  id: string;
  campaignId: string;
  res: Response;
}

class SseManager {
  private clients: Map<string, SseClient[]> = new Map();

  addClient(campaignId: string, clientId: string, res: Response): void {
    const list = this.clients.get(campaignId) || [];
    list.push({ id: clientId, campaignId, res });
    this.clients.set(campaignId, list);
  }

  removeClient(campaignId: string, clientId: string): void {
    const list = this.clients.get(campaignId) || [];
    const updated = list.filter((c) => c.id !== clientId);
    if (updated.length === 0) {
      this.clients.delete(campaignId);
    } else {
      this.clients.set(campaignId, updated);
    }
  }

  emit(campaignId: string, data: Record<string, unknown>): void {
    const list = this.clients.get(campaignId) || [];
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    list.forEach((client) => {
      try {
        client.res.write(payload);
      } catch {
        // Client disconnected
      }
    });
  }
}

export const sseManager = new SseManager();
