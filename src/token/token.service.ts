import { Injectable } from '@nestjs/common';
import { nanoid } from 'nanoid';

@Injectable()
export class TokenService {
  /**
   * Generate a cryptographically strong random string
   * @param length - Length of returned string
   * @param charactersOrType - Characters or one of the supported types
   */
  async generateRandomString(): Promise<string> {
    return nanoid(20);
  }
}
