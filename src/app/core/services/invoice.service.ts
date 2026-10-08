import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../models/api.models';
import { InvoiceSummary } from '../models/invoice.models';
import { rethrowApiError } from './http-error.util';

/** manufest_be's `invoices` module, customer side (`/api/v1/customer/invoices`). */
@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly base = `${environment.apiBaseUrl}/customer/invoices`;
  private readonly http = inject(HttpClient);

  listForOrder(orderUuid: string): Observable<InvoiceSummary[]> {
    return this.http.get<ApiSuccess<InvoiceSummary[]>>(this.base, { params: { orderUuid } }).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  downloadPdf(invoiceUuid: string): Observable<Blob> {
    return this.http.get(`${this.base}/${invoiceUuid}/pdf`, { responseType: 'blob' }).pipe(catchError((err) => rethrowApiError(err)));
  }
}
