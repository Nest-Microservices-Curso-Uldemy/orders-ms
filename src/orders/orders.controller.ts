import { Controller, NotImplementedException, ParseUUIDPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrdersService } from './orders.service';
import { ChangeStatusOrderDto, CreateOrderDto, PaginationOrderDto } from './dto';

@Controller()
export class OrdersController {
	constructor(private readonly ordersService: OrdersService) {}

	@MessagePattern('createOrder')
	create(@Payload() createOrderDto: CreateOrderDto) {
		return this.ordersService.create(createOrderDto);
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
}
