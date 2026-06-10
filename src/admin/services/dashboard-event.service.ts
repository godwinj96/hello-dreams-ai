import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { MetricEventDto, MetricEventType } from '../dto/metric-event.dto';

@Injectable()
export class DashboardEventService {
  private eventSubject = new Subject<MetricEventDto>();

  emitMetricUpdate(metricType: string, data: any): void {
    this.eventSubject.next({
      type: MetricEventType.MetricUpdate,
      timestamp: new Date(),
      data: { metric: metricType, ...data },
    });
  }

  emitUserRegistered(userId: string, email: string): void {
    this.eventSubject.next({
      type: MetricEventType.UserRegistered,
      timestamp: new Date(),
      data: { userId, email },
    });
  }

  emitFeatureUsed(userId: string, module: string, actionType: string): void {
    this.eventSubject.next({
      type: MetricEventType.FeatureUsed,
      timestamp: new Date(),
      data: { userId, module, actionType },
    });
  }

  emitPaymentCompleted(userId: string, amount: number, currency: string): void {
    this.eventSubject.next({
      type: MetricEventType.PaymentCompleted,
      timestamp: new Date(),
      data: { userId, amount, currency },
    });
  }

  emitSubscriptionChanged(userId: string, status: string): void {
    this.eventSubject.next({
      type: MetricEventType.SubscriptionChanged,
      timestamp: new Date(),
      data: { userId, status },
    });
  }

  emitHeartbeat(): void {
    this.eventSubject.next({
      type: MetricEventType.Heartbeat,
      timestamp: new Date(),
      data: {},
    });
  }

  getEventStream(): Observable<MetricEventDto> {
    return this.eventSubject.asObservable();
  }
}






