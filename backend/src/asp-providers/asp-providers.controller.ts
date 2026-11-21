import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AspProvidersService } from './asp-providers.service';
import { CreateAspProviderDto } from './dto/create-asp-provider.dto';
import { UpdateAspProviderDto } from './dto/update-asp-provider.dto';

@ApiTags('asp-providers')
@ApiSecurity('admin-key')
@UseGuards(AdminAuthGuard)
@Controller('asp-providers')
export class AspProvidersController {
  constructor(private readonly service: AspProvidersService) {}

  @Post()
  create(@Body() dto: CreateAspProviderDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAspProviderDto) {
    return this.service.update(id, dto);
  }
}
