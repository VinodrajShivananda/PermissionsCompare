import { describeObject, soqlQuery, toolingQuery } from './salesforceApi';
import type { SalesforceSession } from '../types/permissions';

export class SalesforceClient {
  private session: SalesforceSession;

  constructor(session: SalesforceSession) {
    this.session = session;
  }

  async query<T>(query: string): Promise<T[]> {
    return soqlQuery<T>(
      this.session.accessToken,
      this.session.instanceUrl,
      query,
    );
  }

  async describe(objectName: string) {
    return describeObject(
      this.session.accessToken,
      this.session.instanceUrl,
      objectName,
    );
  }

  async toolingQuery<T>(query: string): Promise<T[]> {
    return toolingQuery<T>(
      this.session.accessToken,
      this.session.instanceUrl,
      query,
    );
  }
}
