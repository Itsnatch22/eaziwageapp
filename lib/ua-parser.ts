import UAParser from 'ua-parser-js';

/**
 * Returns a friendly device name from a User-Agent string.
 * Examples:
 *  - "Samsung SM-A060F" -> "Samsung SM-A060F"
 *  - "iPhone" -> "iPhone"
 *  - "Desktop - Windows 10" -> "Desktop - Windows 10"
 */
export function getDeviceName(userAgent: string | null): string | null {
  if (!userAgent) return null;
  try {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    const device = result.device || {} as any;
    const os = result.os || {} as any;
    const browser = result.browser || {} as any;

    const vendor = device.vendor ? String(device.vendor).trim() : '';
    const model = device.model ? String(device.model).trim() : '';

    if (vendor && model) return `${vendor} ${model}`;
    if (model) return model;

    // Use device type if available (mobile/tablet/console)
    const type = (device.type || '') as string;
    if (type) {
      const prettyType = type === 'mobile' ? 'Mobile' : type === 'tablet' ? 'Tablet' : 'Desktop';
      if (os.name) return `${prettyType} - ${os.name}${os.version ? ` ${os.version}` : ''}`;
      return prettyType;
    }

    // Fallback to OS name or browser
    if (os.name) return `${os.name}${os.version ? ` ${os.version}` : ''}`;
    if (browser.name) return browser.name;

    return null;
  } catch (err) {
    // Be resilient on unexpected UA strings
    return null;
  }
}
