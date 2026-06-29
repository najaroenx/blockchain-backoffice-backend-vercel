import { ADDRESS_ZERO } from 'src/constants';
import { LOGIN_ACCESS_TOKEN } from 'src/providers/token/token.constants';

describe('Constants', () => {
  it('should expose the expected zero address constant', () => {
    expect(ADDRESS_ZERO).toBe('0x0000000000000000000000000000000000000000');
    expect(ADDRESS_ZERO).toMatch(/^0x[0-9a-f]{40}$/i);
  });

  it('should expose the expected login access token key', () => {
    expect(LOGIN_ACCESS_TOKEN).toBe('LOGIN_ACCESS_TOKEN');
  });
});
