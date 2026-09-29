import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick, discardPeriodicTasks } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { BANNER_POLL_MS, ResponsiveBannerComponent } from './responsive-banner.component';
import { ApplicationAssetService } from '../../core/services/application-asset.service';
import { ActiveAssetSet, ApplicationAsset } from '../../core/models/application-asset.models';

function asset(uuid: string): ApplicationAsset {
  return {
    uuid,
    category: 'banner',
    placementKey: 'home_hero_banner',
    title: `Banner ${uuid}`,
    occasion: null,
    linkUrl: null,
    sortOrder: 0,
    files: { default: { uuid: `f-${uuid}`, url: `https://s3/${uuid}.jpg`, altText: null, width: null, height: null } },
  };
}

describe('ResponsiveBannerComponent', () => {
  let service: jasmine.SpyObj<ApplicationAssetService>;
  let emitted: boolean[];

  function create(cached: ActiveAssetSet | null): ComponentFixture<ResponsiveBannerComponent> {
    service = jasmine.createSpyObj('ApplicationAssetService', ['getActive', 'readCachedSet', 'writeCachedSet', 'preloadImages', 'assetSrc']);
    service.readCachedSet.and.returnValue(cached);
    service.preloadImages.and.returnValue(Promise.resolve());
    service.assetSrc.and.callFake((url) => (url ? `PROXY(${url})` : null));

    TestBed.configureTestingModule({
      imports: [ResponsiveBannerComponent],
      providers: [{ provide: ApplicationAssetService, useValue: service }],
    });
    const fixture = TestBed.createComponent(ResponsiveBannerComponent);
    fixture.componentRef.setInput('placementKey', 'home_hero_banner');
    emitted = [];
    fixture.componentInstance.assetsLoaded.subscribe((v) => emitted.push(v));
    return fixture;
  }

  it('renders the cached set immediately, before /active answers', fakeAsync(() => {
    const pending = new Subject<ActiveAssetSet>();
    const fixture = create({ assets: [asset('a')], version: 'v1' });
    service.getActive.and.returnValue(pending);

    fixture.detectChanges();

    expect(fixture.componentInstance.assets().map((a) => a.uuid)).toEqual(['a']);
    expect(emitted).toEqual([true]);
    fixture.destroy();
  }));

  it('does nothing when /active returns the same version as what is shown', fakeAsync(() => {
    const cachedSet = { assets: [asset('a')], version: 'v1' };
    const fixture = create(cachedSet);
    service.getActive.and.returnValue(of({ assets: [asset('a')], version: 'v1' }));

    fixture.detectChanges();
    flushMicrotasks();

    expect(service.writeCachedSet).not.toHaveBeenCalled();
    expect(service.preloadImages).not.toHaveBeenCalled();
    expect(emitted).toEqual([true]);
    fixture.destroy();
  }));

  it('preloads, swaps and re-caches when the version changes', fakeAsync(() => {
    const fixture = create({ assets: [asset('a')], version: 'v1' });
    const next = { assets: [asset('b'), asset('c')], version: 'v2' };
    service.getActive.and.returnValue(of(next));

    fixture.detectChanges();
    expect(service.preloadImages).toHaveBeenCalledWith(['PROXY(https://s3/b.jpg)', 'PROXY(https://s3/c.jpg)']);
    // Still showing the old banner until the new images are loaded.
    expect(fixture.componentInstance.assets().map((a) => a.uuid)).toEqual(['a']);

    flushMicrotasks();
    expect(fixture.componentInstance.assets().map((a) => a.uuid)).toEqual(['b', 'c']);
    expect(service.writeCachedSet).toHaveBeenCalledWith('home_hero_banner', undefined, next);
    fixture.destroy();
  }));

  it('with no cache, shows the first response right away (no preload wait)', fakeAsync(() => {
    const fixture = create(null);
    service.getActive.and.returnValue(of({ assets: [asset('a')], version: 'v1' }));

    fixture.detectChanges();

    expect(service.preloadImages).not.toHaveBeenCalled();
    expect(fixture.componentInstance.assets().length).toBe(1);
    expect(emitted).toEqual([true]);
    fixture.destroy();
  }));

  it('polls /active every 15 minutes and picks up a newly activated banner', fakeAsync(() => {
    const fixture = create(null);
    service.getActive.and.returnValue(of({ assets: [], version: 'empty' }));
    fixture.detectChanges();
    expect(emitted).toEqual([false]);

    service.getActive.and.returnValue(of({ assets: [asset('new')], version: 'v2' }));
    tick(BANNER_POLL_MS - 1);
    expect(service.getActive).toHaveBeenCalledTimes(1);
    tick(1);
    expect(service.getActive).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.assets().map((a) => a.uuid)).toEqual(['new']);
    expect(emitted).toEqual([false, true]);

    fixture.destroy();
    discardPeriodicTasks();
  }));

  it('skips polls while the tab is hidden', fakeAsync(() => {
    const fixture = create(null);
    service.getActive.and.returnValue(of({ assets: [], version: 'empty' }));
    fixture.detectChanges();

    const hidden = spyOnProperty(document, 'hidden').and.returnValue(true);
    tick(BANNER_POLL_MS);
    expect(service.getActive).toHaveBeenCalledTimes(1);

    // Coming back to an overdue tab checks straight away.
    hidden.and.returnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(service.getActive).toHaveBeenCalledTimes(2);

    fixture.destroy();
    discardPeriodicTasks();
  }));

  it('keeps the cached banner when a poll fails', fakeAsync(() => {
    const fixture = create({ assets: [asset('a')], version: 'v1' });
    service.getActive.and.returnValue(throwError(() => ({ code: 'NETWORK_ERROR' })));

    fixture.detectChanges();

    expect(fixture.componentInstance.assets().map((a) => a.uuid)).toEqual(['a']);
    expect(emitted).toEqual([true]);
    fixture.destroy();
  }));

  it('reports "nothing to show" when the first fetch fails and there is no cache', fakeAsync(() => {
    const fixture = create(null);
    service.getActive.and.returnValue(throwError(() => ({ code: 'NETWORK_ERROR' })));

    fixture.detectChanges();

    expect(emitted).toEqual([false]);
    fixture.destroy();
  }));

  it('stops polling once destroyed', fakeAsync(() => {
    const fixture = create(null);
    service.getActive.and.returnValue(of({ assets: [], version: 'empty' }));
    fixture.detectChanges();
    fixture.destroy();

    tick(BANNER_POLL_MS * 2);
    expect(service.getActive).toHaveBeenCalledTimes(1);
  }));
});
