import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { OrderDetailComponent } from './order-detail.component';
import { OrderDetail, OrderItem, Shipment } from '../../core/models/order.models';
import { OrderService } from '../../core/services/order.service';
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

describe('OrderDetailComponent — request a call back', () => {
  const baseOrder = { uuid: 'o-1', shippingAddress: { phone: '+919876543210' } } as OrderDetail;
  let requestSupportCall: jasmine.Spy;

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
    const component = TestBed.createComponent(OrderDetailComponent).componentInstance;
    requestSupportCall = spyOn(TestBed.inject(OrderService), 'requestSupportCall');
    component.order.set(baseOrder);
    return component;
  }

  it('starts from the delivery number', () => {
    const component = create();
    component.openSupportForm();
    expect(component.supportPhone).toBe('+919876543210');
    expect(component.showSupportForm()).toBeTrue();
  });

  it('refuses a bad number without calling the API', () => {
    const component = create();
    component.openSupportForm();
    component.supportPhone = '12345';
    component.submitSupportRequest();
    expect(component.supportError()).toBe('Enter a valid 10-digit mobile number.');
    expect(requestSupportCall).not.toHaveBeenCalled();
  });

  it('sends the request and shows the flagged order', () => {
    const flagged = { ...baseOrder, supportRequestedAt: '2026-11-03T10:00:00Z' };
    const component = create();
    requestSupportCall.and.returnValue(of(flagged));
    component.openSupportForm();
    component.supportMessage = '  Where is it?  ';
    component.submitSupportRequest();
    expect(requestSupportCall).toHaveBeenCalledOnceWith('o-1', { callbackPhone: '+919876543210', message: 'Where is it?' });
    expect(component.order()).toEqual(flagged);
    expect(component.showSupportForm()).toBeFalse();
  });

  it('keeps the form open with the error when it fails', () => {
    const component = create();
    requestSupportCall.and.returnValue(throwError(() => ({ message: 'Try later' })));
    component.openSupportForm();
    component.submitSupportRequest();
    expect(component.supportError()).toBe('Try later');
    expect(component.showSupportForm()).toBeTrue();
    expect(component.supportSubmitting()).toBeFalse();
  });
});

// A payment whose confirmation is still on its way (customer's connection
// dropped mid-payment): the page keeps re-reading the order until the server —
// webhook or reconcile job — settles it, with no manual refresh.
describe('OrderDetailComponent — waiting for payment confirmation', () => {
  let orders: jasmine.SpyObj<OrderService>;

  function create() {
    TestBed.configureTestingModule({
      imports: [OrderDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OrderService, useValue: orders },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ orderUuid: 'o-1' }), queryParamMap: convertToParamMap({}) } } },
      ],
    });
    const fixture = TestBed.createComponent(OrderDetailComponent);
    // ngOnInit only - the polling logic is under test, not the template.
    fixture.componentInstance.ngOnInit();
    return fixture;
  }

  const orderWith = (orderStatus: string) => ({ uuid: 'o-1', orderStatus, items: [] }) as unknown as OrderDetail;

  beforeEach(() => {
    orders = jasmine.createSpyObj<OrderService>('OrderService', ['getOrder', 'listReturns']);
    orders.listReturns.and.returnValue(of([]));
  });

  it('re-reads a payment_processing order until it is placed, then stops', fakeAsync(() => {
    orders.getOrder.and.returnValues(of(orderWith('payment_processing')), of(orderWith('payment_processing')), of(orderWith('placed')));
    const fixture = create();
    expect(orders.getOrder).toHaveBeenCalledTimes(1);

    tick(8000);
    expect(orders.getOrder).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.isUnplaced).toBeTrue();

    tick(8000);
    expect(orders.getOrder).toHaveBeenCalledTimes(3);
    expect(fixture.componentInstance.order()?.orderStatus).toBe('placed');

    tick(60000);
    expect(orders.getOrder).toHaveBeenCalledTimes(3);
    fixture.destroy();
  }));

  it('keeps trying after a dropped request', fakeAsync(() => {
    orders.getOrder.and.returnValues(of(orderWith('awaiting_payment')), throwError(() => new Error('offline')), of(orderWith('placed')));
    const fixture = create();

    tick(8000);
    tick(8000);
    expect(fixture.componentInstance.order()?.orderStatus).toBe('placed');
    fixture.destroy();
  }));

  it('does not poll an order that is already placed, or one whose payment failed', fakeAsync(() => {
    orders.getOrder.and.returnValue(of(orderWith('placed')));
    const placed = create();
    tick(30000);
    expect(orders.getOrder).toHaveBeenCalledTimes(1);
    placed.destroy();

    TestBed.resetTestingModule();
    orders = jasmine.createSpyObj<OrderService>('OrderService', ['getOrder', 'listReturns']);
    orders.listReturns.and.returnValue(of([]));
    orders.getOrder.and.returnValue(of(orderWith('payment_failed')));
    const failed = create();
    tick(30000);
    expect(orders.getOrder).toHaveBeenCalledTimes(1);
    failed.destroy();
  }));

  it('stops polling when the page is left', fakeAsync(() => {
    orders.getOrder.and.returnValue(of(orderWith('payment_processing')));
    const fixture = create();
    fixture.destroy();
    tick(60000);
    expect(orders.getOrder).toHaveBeenCalledTimes(1);
    discardPeriodicTasks();
  }));
});

describe("OrderDetailComponent — parcels that didn't reach the customer", () => {
  let reportNotReceived: jasmine.Spy;

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
    reportNotReceived = spyOn(TestBed.inject(OrderService), 'reportNotReceived');
    return TestBed.createComponent(OrderDetailComponent).componentInstance;
  }

  const inHours = (h: number) => new Date(Date.now() + h * 3600 * 1000).toISOString();
  const delivered = (overrides: Partial<OrderItem> = {}) =>
    ({ uuid: 'item-1', itemStatus: 'delivered', notReceived: null, notReceivedReportableUntil: inHours(20), ...overrides }) as OrderItem;

  it('offers "I didn\'t receive this" only while the backend allows it', () => {
    const component = create();
    expect(component.canReportNotReceived(delivered())).toBeTrue();
    expect(component.canReportNotReceived(delivered({ notReceivedReportableUntil: null }))).toBeFalse();
    expect(component.canReportNotReceived(delivered({ notReceivedReportableUntil: inHours(-1) }))).toBeFalse();
    expect(component.canReportNotReceived(delivered({ itemStatus: 'shipped' }))).toBeFalse();
  });

  it('sends the trimmed note and shows the updated order', () => {
    const component = create();
    const updated = { uuid: 'o-1' } as OrderDetail;
    reportNotReceived.and.returnValue(of(updated));
    component.openNotReceivedForm(delivered());
    component.notReceivedNote = '  Nobody came  ';

    component.submitNotReceived();

    expect(reportNotReceived).toHaveBeenCalledWith('item-1', 'Nobody came');
    expect(component.order()).toBe(updated);
    expect(component.notReceivedItemUuid()).toBeNull();
  });

  it('keeps the form open with the message when it fails', () => {
    const component = create();
    reportNotReceived.and.returnValue(throwError(() => ({ code: 'NOT_RECEIVED_WINDOW_CLOSED', message: 'Please contact support.' })));
    component.openNotReceivedForm(delivered());
    component.submitNotReceived();
    expect(component.notReceivedError()).toBe('Please contact support.');
    expect(component.notReceivedItemUuid()).toBe('item-1');
  });

  it('tells the customer where their report stands', () => {
    const component = create();
    const report = { reportedAt: '', note: null, resolvedAt: null, resolutionNote: null };
    expect(component.notReceivedStatus(delivered({ notReceived: { ...report, status: 'OPEN' } }))).toContain("We're checking with the courier");
    expect(component.notReceivedStatus(delivered({ notReceived: { ...report, status: 'REFUNDED', resolutionNote: 'Sorry about that.' } }))).toBe(
      "We've refunded you for this item. Sorry about that.",
    );
    expect(component.notReceivedStatus(delivered())).toBeNull();
  });

  it('explains returned and lost parcels in plain words', () => {
    const component = create();
    expect(component.statusLabel('rto_completed')).toBe('Returned to seller');
    expect(component.statusLabel('lost')).toBe('Lost in transit');
    expect(component.returnStatusNote('lost')).toContain('refund');
  });
});

describe('OrderDetailComponent — return with unboxing video', () => {
  let uploadReturnMedia: jasmine.Spy;
  let requestItemReturn: jasmine.Spy;

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
    const service = TestBed.inject(OrderService);
    uploadReturnMedia = spyOn(service, 'uploadReturnMedia');
    requestItemReturn = spyOn(service, 'requestItemReturn');
    spyOn(service, 'listReturns').and.returnValue(of([]));
    const component = TestBed.createComponent(OrderDetailComponent).componentInstance;
    component.order.set({ uuid: 'o-1' } as OrderDetail);
    component.openItemReturnForm({ uuid: 'item-1' } as OrderItem);
    return component;
  }

  const pick = (file: File) => ({ target: { files: [file], value: 'x' } }) as unknown as Event;
  const video = (sizeMb = 1, type = 'video/mp4') => new File([new Uint8Array(sizeMb * 1024 * 1024)], 'unbox.mp4', { type });

  it('will not send a return without the uploaded unboxing video', () => {
    const component = create();
    component.returnReason = 'Colour is different';
    component.returnCoverConfirmed = true;
    component.confirmReturn();
    expect(component.returnError()).toBe('Add your unboxing video. It is required for a return.');
    expect(requestItemReturn).not.toHaveBeenCalled();
  });

  it('refuses a video over the size limit before uploading it', () => {
    const component = create();
    component.onReturnVideoSelected(pick(video(51)));
    expect(component.returnVideo()?.status).toBe('error');
    expect(component.returnVideo()?.error).toContain('over 50MB');
    expect(uploadReturnMedia).not.toHaveBeenCalled();
  });

  it('refuses a file that is not a video', () => {
    const component = create();
    component.onReturnVideoSelected(pick(new File(['x'], 'notes.pdf', { type: 'application/pdf' })));
    expect(component.returnVideo()?.error).toContain('video file');
  });

  it('uploads the video, then raises the return with it and the uploaded photos', async () => {
    const component = create();
    uploadReturnMedia.and.callFake((_uuid: string, payload: { mediaType: string }) =>
      of({ uuid: payload.mediaType === 'video' ? 'vid-1' : 'pic-1', mediaType: payload.mediaType, sizeBytes: 10 }),
    );
    requestItemReturn.and.returnValue(of({ uuid: 'o-1' } as OrderDetail));

    component.onReturnVideoSelected(pick(video()));
    component.onReturnPhotosSelected(pick(new File(['x'], 'tag.jpg', { type: 'image/jpeg' })));
    // FileReader is async.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(component.returnVideo()?.status).toBe('done');
    const sent = uploadReturnMedia.calls.allArgs().map((args) => args[1]);
    expect(sent).toContain(jasmine.objectContaining({ mediaType: 'video', fileName: 'unbox.mp4', mimeType: 'video/mp4' }));
    expect(sent).toContain(jasmine.objectContaining({ mediaType: 'image', fileName: 'tag.jpg' }));

    component.returnReason = '  Colour is different  ';
    component.returnCoverConfirmed = true;
    component.confirmReturn();

    expect(requestItemReturn).toHaveBeenCalledWith('item-1', { reason: 'Colour is different', videoMediaUuid: 'vid-1', photoMediaUuids: ['pic-1'] });
    expect(component.returnPanel()).toBeNull();
  });

  it('shows where an approved return stands', () => {
    const component = create();
    component.returns.set([
      {
        uuid: 'r-1',
        orderItemUuid: 'item-1',
        status: 'APPROVED',
        reason: 'x',
        adminNote: null,
        requestedAt: '',
        reviewedAt: null,
        pickup: { courierName: 'Delhivery', awb: 'A1', trackingUrl: null, pickupScheduledDate: '2026-11-19T04:30:00Z', dispatchStatus: 'pickup_scheduled' },
        receivedAt: null,
        completedAt: null,
      },
    ]);
    const text = component.returnProgress({ uuid: 'item-1' } as OrderItem)!;
    expect(text).toContain('Delhivery will pick it up on');
    expect(text).toContain('refund starts once it reaches the seller');
  });
});
