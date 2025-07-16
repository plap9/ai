import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { UserResponseDto, UpdateUserDto } from './dto';

interface GraphQLContext {
  req: {
    user: {
      id: string;
      email: string;
    };
  };
}

@Resolver('User')
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query('me')
  @UseGuards() // GqlAuthGuard will be added later
  async me(@Context() context: GraphQLContext): Promise<UserResponseDto> {
    const user = await this.userService.findById(context.req.user.id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  @Query('user')
  @UseGuards() // GqlAuthGuard will be added later
  async user(@Args('id') id: string): Promise<UserResponseDto | null> {
    return this.userService.findById(id);
  }

  @Mutation('updateProfile')
  @UseGuards() // GqlAuthGuard will be added later
  async updateProfile(
    @Args('input') input: UpdateUserDto,
    @Context() context: GraphQLContext,
  ): Promise<UserResponseDto> {
    return this.userService.update(context.req.user.id, input);
  }
}
