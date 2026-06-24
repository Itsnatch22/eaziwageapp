import { UAParser } from 'ua-parser-js';

export function getDeviceName(userAgent: string | null): string | null {
  if (!userAgent) return null;
  try {
    // '; Win11' is a sentinel appended at login time when Sec-CH-UA-Platform-Version >= 14,
    // since Windows 11 reports 'Windows NT 10.0' in the UA string — identical to Windows 10.
    if (userAgent.includes('; Win11')) {
      const parser = new UAParser(userAgent.replace('; Win11', ''));
      const browser = parser.getResult().browser;
      return `Desktop - Windows 11${browser.name ? ` · ${browser.name}` : ''}`;
    }

    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    const device = result.device;
    const os = result.os;
    const browser = result.browser;

    const vendor = device.vendor ? String(device.vendor).trim() : '';
    const model = device.model ? String(device.model).trim() : '';

    if (vendor && model) return `${vendor} ${model}`;
    if (model) return model;

    const type = (device.type || '') as string;
    if (type) {
      const prettyType = type === 'mobile' ? 'Mobile' : type === 'tablet' ? 'Tablet' : 'Desktop';
      if (os.name) return `${prettyType} - ${os.name}${os.version ? ` ${os.version}` : ''}`;
      return prettyType;
    }

    if (os.name) return `${os.name}${os.version ? ` ${os.version}` : ''}`;
    if (browser.name) return browser.name;

    return null;
  } catch {
    return null;
  }
}
