import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../models/api.models';
import { Shipment } from '../models/order.models';
import { rethrowApiError } from './http-error.util';

/**
 * `manufest_be`'s `shipments` module, `customerRouter`
 * (`src/modules/shipments/shipments.api.js`, mounted
 * `/api/v1/customer/shipments`, added 2026-09-23) — read-only,
 * ownership-checked mirror of the parcel a seller entered by hand for one
 * order item. Manual courier/tracking entry only, no courier API
 * integrated (see that module's own header comment) — `null` just means
 * no parcel has been created for this item yet, not an error.
 */
@Injectable({ providedIn: 'root' })
export class ShipmentService {
  private readonly base = `${environment.apiBaseUrl}/customer/shipments`;
  private readonly http = inject(HttpClient);

  getForItem(orderItemUuid: string): Observable<Shipment | null> {
    return this.http.get<ApiSuccess<Shipment | null>>(`${this.base}/order-items/${orderItemUuid}`).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }
}
