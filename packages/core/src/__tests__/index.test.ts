import { main } from '../index.js';

describe('main', () => {
  it('should run without errors', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    expect(() => main()).not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Claude Config - Business Logic Framework'
    );

    consoleSpy.mockRestore();
  });
});
