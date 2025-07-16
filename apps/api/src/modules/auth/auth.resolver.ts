import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto';

interface GraphQLContext {
  req: {
    user: {
      id: string;
      email: string;
    };
  };
}

@Resolver('Auth')
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation('register')
  async register(@Args('input') input: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(input);
  }

  @Mutation('login')
  async login(@Args('input') input: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(input);
  }

  @Mutation('refreshToken')
  async refreshToken(
    @Args('refreshToken') refreshToken: string,
  ): Promise<AuthResponseDto> {
    return this.authService.refreshToken(refreshToken);
  }

  @Mutation('logout')
  @UseGuards() // GqlAuthGuard will be added later
  async logout(@Context() context: GraphQLContext): Promise<boolean> {
    await this.authService.logout(context.req.user.id);
    return true;
  }
}
