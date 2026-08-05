/**
 * Types for the AIS SMS Gateway integration (Service Parameter specification,
 * BDG_35145678001). Spec covers two directions:
 *  - MT (Mobile Terminate): we POST a message to AIS for delivery to a phone.
 *  - DR (Delivery Report): AIS POSTs the delivery status back to us.
 */

export type AisSmsContentType = 'TEXT' | 'UNICODE';

export interface AisSmsSendParams {
  /** Receiver phone number, e.g. 66818452233 */
  to: string;
  /** Message body. Thai/unicode text is auto-detected unless ctype is set. */
  content: string;
  /** TEXT for English SMS, UNICODE for Thai SMS. Auto-detected if omitted. */
  ctype?: AisSmsContentType;
  /** Request an online delivery report (REPORT=Y/N). Defaults to true. */
  report?: boolean;
}

export interface AisSmsSendResult {
  success: boolean;
  /** 'OK' or 'ERR' */
  status: string;
  /** e.g. 'SUCCESS' on success, or 'CORP:INVALID_FROM' style code on error */
  detail: string;
  /** AIS message id, present on success */
  smid: string | null;
  /** Raw XML response body, kept for troubleshooting */
  raw: string;
}

export interface AisSmsDeliveryReport {
  ntype: string;
  /** Phone number the delivery report is about */
  from: string;
  /** AIS message id this report refers to */
  smid: string;
  status: 'OK' | 'ERR';
  /** e.g. 'DELIVRD' on success, or an error code/'EXPIRED' on failure */
  detail: string;
}

export interface AisSmsConnectivityCheck {
  /** Whether a raw TCP connection to the gateway succeeded */
  connected: boolean;
  /** Present when connected is false */
  error?: string;
  host: string;
  port: number;
  /** This server's outbound IP as seen externally, or null if the lookup failed */
  egressIp: string | null;
}
