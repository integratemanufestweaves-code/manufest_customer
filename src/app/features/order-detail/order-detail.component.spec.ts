import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { OrderDetailComponent } from './order-detail.component';
import { Shipment } from '../../core/models/order.models';

// Tracking-display helpers only — the order load itself is left pending.
describe('OrderDetailComponent — parcel tracking display', () => {
  function create() {
    TestBed.configureTestingModule({
      imports: [OrderDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ orderUuid: 'o-1' }), queryParamMap: convertToParamMap({}) } } },
      ],
    });
    return TestBed.createComponent(OrderDetailComponent).componentInstance;
  }

  const shipment = (overrides: Partial<Shipment> = {}): Shipment => ({
    uuid: 's-1',
    orderItemUuid: 'i-1',
    provider: 'shiprocket',
    courierPartner: 'Blue Dart Air',
    trackingNumber: 'AWB123',
    trackingUrl: 'https://shiprocket.co/tracking/AWB123',
    dispatchStatus: 'in_transit',
    dispatchDate: null,
    deliveredDate: null,
    estimatedDeliveryDate: null,
    events: [],
    ...overrides,
  });

  it('uses customer-friendly wording for courier statuses', () => {
    const component = create();
    expect(component.dispatchLabel('ready_to_ship')).toBe('Packed, waiting for courier pickup');
    expect(component.dispatchLabel('out_for_delivery')).toBe('Out for delivery');
    expect(component.dispatchLabel('rto')).toBe('Returning to seller');
    expect(component.dispatchLabel('something_new')).toBe('Something new');
  });

  it('hides a cancelled booking or one still waiting for its AWB', () => {
    const component = create();
    expect(component.visibleShipment(shipment({ dispatchStatus: 'cancelled' }))).toBeNull();
    expect(component.visibleShipment(shipment({ trackingNumber: null, dispatchStatus: 'pending' }))).toBeNull();
    expect(component.visibleShipment(null)).toBeNull();
  });

  it('shows an active parcel as-is', () => {
    const component = create();
    const s = shipment();
    expect(component.visibleShipment(s)).toBe(s);
  });
});
