import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({ providedIn: 'root' })
export class FunctionsService {
  private functions = inject(Functions);

  async callFunction<T, R>(name: string, data: T): Promise<R> {
    const callable = httpsCallable<T, R>(this.functions, name);
    const result = await callable(data);
    return result.data;
  }
}
