import { ErrorsAndWarnings, wrapLogger, LogFunction } from '../../src/utils/logger';

describe('wrapLogger', () => {
  const basicLog = jest.fn();
  let logWithTrack: LogFunction;
  let errorsAndWarnings: ErrorsAndWarnings;
  beforeAll(() => {
    errorsAndWarnings = new ErrorsAndWarnings();
    logWithTrack = wrapLogger(basicLog, errorsAndWarnings);
  });

  beforeEach(() => {
    errorsAndWarnings.reset();
    basicLog.mockClear();
  });

  it('should track errors and warnings', () => {
    logWithTrack('warn', 'warn1');
    logWithTrack('warn', 'warn2');
    logWithTrack('error', 'error1');
    logWithTrack('error', 'error2');
    expect(errorsAndWarnings.warnings).toHaveLength(2);
    expect(errorsAndWarnings.warnings).toContainEqual('warn1');
    expect(errorsAndWarnings.warnings).toContainEqual('warn2');
    expect(errorsAndWarnings.errors).toHaveLength(2);
    expect(errorsAndWarnings.errors).toContainEqual('error1');
    expect(errorsAndWarnings.errors).toContainEqual('error2');
  });

  it('should reset errors and warnings', () => {
    logWithTrack('warn', 'warn1');
    logWithTrack('error', 'error1');
    expect(errorsAndWarnings.warnings).toHaveLength(1);
    expect(errorsAndWarnings.warnings).toContainEqual('warn1');
    expect(errorsAndWarnings.errors).toHaveLength(1);
    expect(errorsAndWarnings.errors).toContainEqual('error1');
    errorsAndWarnings.reset();
    expect(errorsAndWarnings.errors).toHaveLength(0);
    expect(errorsAndWarnings.warnings).toHaveLength(0);
  });

  it('should call the log callback', () => {
    logWithTrack('error', 'error1');
    expect(basicLog).toHaveBeenCalledTimes(1);
    expect(basicLog).toHaveBeenCalledWith('error', 'error1');
    logWithTrack('info', 'info1');
    expect(basicLog).toHaveBeenCalledTimes(2);
    expect(basicLog).toHaveBeenCalledWith('info', 'info1');
  });
});
