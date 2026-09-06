import { stripe as client } from './client.js';

export const findCustomer = (id: string) => client.customers.retrieve(id);

export class CustomerService {
  async get(id: string) {
    return client.customers.retrieve(id);
  }
}
