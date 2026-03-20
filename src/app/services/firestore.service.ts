import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  QueryConstraint,
  WhereFilterOp,
} from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private firestore = inject(Firestore);

  async getCollection<T>(path: string): Promise<T[]> {
    const colRef = collection(this.firestore, path);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as T);
  }

  async queryCollection<T>(path: string, constraints: QueryConstraint[]): Promise<T[]> {
    const colRef = collection(this.firestore, path);
    const q = query(colRef, ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as T);
  }

  createWhereConstraint(field: string, opStr: WhereFilterOp, value: unknown): QueryConstraint {
    return where(field, opStr, value);
  }
}
