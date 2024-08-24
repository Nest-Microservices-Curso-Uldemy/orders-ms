import { Controller, ParseUUIDPipe } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { OrdersService } from './orders.service';
import { ChangeStatusOrderDto, CreateOrderDto, PaginationOrderDto, PaidOrderDto } from './dto';

@Controller()
export class OrdersController {
	constructor(private readonly ordersService: OrdersService) {}

	@MessagePattern('createOrder')
	async create(@Payload() createOrderDto: CreateOrderDto) {
		const order = await this.ordersService.create(createOrderDto);

		const paymentSession = await this.ordersService.createPaymentSession(order);

		return { order, paymentSession };
	}

	@MessagePattern('findAllOrders')
	findAll(@Payload() paginationDto: PaginationOrderDto) {
		return this.ordersService.findAll(paginationDto);
	}

	@MessagePattern('findOneOrder')
	findOne(@Payload('id', ParseUUIDPipe) id: string) {
		return this.ordersService.findOne(id);
	}

	@MessagePattern('changeOrderStatus')
	changeOrderStatus(@Payload() changeStatusOrderDto: ChangeStatusOrderDto) {
		return this.ordersService.changeOrderStatus(changeStatusOrderDto);
	}

	@EventPattern('payment.succeeded')
	paidOrder(@Payload() paidOrderDto: PaidOrderDto) {
		console.log(paidOrderDto);
		return this.ordersService.paidOrder(paidOrderDto);
	}
}
