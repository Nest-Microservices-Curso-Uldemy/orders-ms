import { DynamicModule, ForwardReference, Module, Type } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { envs, NATS_SERVICE } from 'src/config';

type modulesType = Type<any> | DynamicModule | Promise<DynamicModule> | ForwardReference<any>;

const modules: modulesType[] = [
	ClientsModule.register([
		{
			name: NATS_SERVICE,
			transport: Transport.NATS,
			options: {
				servers: envs.natsServers,
			},
		},
	]),
];

@Module({
	imports: modules,
	exports: modules,
})
export class NatsModule {}
