export class LoggingService {
	private static isEnabled = false;

	static enable() {
		this.isEnabled = true;
	}

	static disable() {
		this.isEnabled = false;
	}

	static info(_message: string, ..._args: unknown[]) {
		if (!this.isEnabled) return;
	}

	static warn(_message: string, ..._args: unknown[]) {
		if (!this.isEnabled) return;
	}

	static error(_message: string, ..._args: unknown[]) {
		if (!this.isEnabled) return;
	}
}
