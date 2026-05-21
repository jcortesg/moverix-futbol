import { Injectable } from '@nestjs/common'
import * as admin from 'firebase-admin'

const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID ?? 'moverix-social'

@Injectable()
export class FirestoreService {
  private readonly firestore: admin.firestore.Firestore

  constructor() {
    this.firestore = admin.firestore()
    this.firestore.settings({ databaseId: DATABASE_ID })
  }

  get db() {
    return this.firestore
  }
}
