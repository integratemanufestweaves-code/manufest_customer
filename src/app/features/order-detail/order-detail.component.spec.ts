import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { OrderDetailComponent } from './order-detail.component';
import { OrderItem, Shipment } from '../../core/models/order.models';
import { ReviewService } from '../../core/services/review.service';
import { ProductReview } from '../../core/models/review.models';
import { of, throwError } from 'rxjs';

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

describe('OrderDetailComponent — rate this product', () => {
  let review: jasmine.SpyObj<ReviewService>;

  beforeEach(() => {
    review = jasmine.createSpyObj<ReviewService>('ReviewService', ['create', 'listForProduct']);
  });

  function create() {
    TestBed.configureTestingModule({
      imports: [OrderDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReviewService, useValue: review },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ orderUuid: 'o-1' }), queryParamMap: convertToParamMap({}) } } },
      ],
    });
    return TestBed.createComponent(OrderDetailComponent).componentInstance;
  }

  const item = { uuid: 'item-1' } as OrderItem;

  it('opens a fresh form for one item at a time', () => {
    const component = create();
    component.reviewRating.set(3);
    component.reviewText = 'old text';
    component.reviewError.set('old error');

    component.openReviewForm(item);

    expect(component.reviewItemUuid()).toBe('item-1');
    expect(component.reviewRating()).toBe(0);
    expect(component.reviewText).toBe('');
    expect(component.reviewError()).toBeNull();

    component.closeReviewForm();
    expect(component.reviewItemUuid()).toBeNull();
  });

  it('asks for a star rating before sending anything', () => {
    const component = create();
    component.openReviewForm(item);
    component.submitReview();
    expect(component.reviewError()).toBe('Pick a star rating.');
    expect(review.create).not.toHaveBeenCalled();
  });

  it('sends the rating and trimmed text, then marks the item reviewed', () => {
    review.create.and.returnValue(of({ uuid: 'r-1', rating: 5, review: 'Lovely', images: [], status: 'active', createdAt: '' }));
    const component = create();
    component.openReviewForm(item);
    component.reviewRating.set(5);
    component.reviewText = '  Lovely  ';

    component.submitReview();

    expect(review.create).toHaveBeenCalledWith({ orderItemUuid: 'item-1', rating: 5, review: 'Lovely' });
    expect(component.reviewItemUuid()).toBeNull();
    expect(component.reviewSubmitting()).toBeFalse();
    expect(component.reviewedItemUuids().has('item-1')).toBeTrue();
  });

  it('leaves out blank text', () => {
    review.create.and.returnValue(of({} as ProductReview));
    const component = create();
    component.openReviewForm(item);
    component.reviewRating.set(2);
    component.reviewText = '   ';
    component.submitReview();
    expect(review.create).toHaveBeenCalledWith({ orderItemUuid: 'item-1', rating: 2, review: undefined });
  });

  it('treats ALREADY_REVIEWED as done rather than an error', () => {
    review.create.and.returnValue(throwError(() => ({ code: 'ALREADY_REVIEWED', message: 'Already reviewed' })));
    const component = create();
    component.openReviewForm(item);
    component.reviewRating.set(4);
    component.submitReview();
    expect(component.reviewError()).toBeNull();
    expect(component.reviewItemUuid()).toBeNull();
    expect(component.reviewedItemUuids().has('item-1')).toBeTrue();
  });

  it('keeps the form open with the message on any other error', () => {
    review.create.and.returnValue(throwError(() => ({ code: 'ITEM_NOT_DELIVERED', message: 'You can only review a delivered item' })));
    const component = create();
    component.openReviewForm(item);
    component.reviewRating.set(4);
    component.submitReview();
    expect(component.reviewError()).toBe('You can only review a delivered item');
    expect(component.reviewItemUuid()).toBe('item-1');
    expect(component.reviewedItemUuids().size).toBe(0);
  });

  it('does nothing when no form is open', () => {
    const component = create();
    component.submitReview();
    expect(review.create).not.toHaveBeenCalled();
  });
});
