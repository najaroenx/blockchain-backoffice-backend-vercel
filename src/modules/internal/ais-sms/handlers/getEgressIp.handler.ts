import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

const IP_ECHO_URL = 'https://api.ipify.org?format=json';

@Injectable()
export class GetEgressIp {
  private readonly logger = new Logger(GetEgressIp.name);

  /**
   * Reports this server's outbound (egress) public IP, as seen by an
   * external IP-echo service. Used to tell a third party (e.g. AIS) which
   * IP to allow through their firewall for outbound requests we make to them.
   */
  async execute(): Promise<{ ip: string }> {
    try {
      const response = await fetch(IP_ECHO_URL);

      if (!response.ok) {
        throw new Error(
          `IP echo service HTTP error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as { ip: string };
      this.logger.log(`Egress IP reported as ${data.ip}`);
      return { ip: data.ip };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to determine egress IP: ${message}`);
      throw new ServiceUnavailableException(
        `Failed to determine egress IP: ${message}`,
      );
    }
  }
}
