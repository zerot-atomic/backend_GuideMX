import { Controller, Post, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
// import { Req, UseGuards, Get } from '@nestjs/common';
import { GoogleAuthGuard } from './google-auth.guard';


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

    @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {
    // Passport redirige a Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleCallback(@Request() req: any) {
    return this.authService.googleLogin(req.user);
  }

  /** Login con Google para la app móvil (idToken de google_sign_in). */
  @Post('google')
  googleMobile(@Body() dto: GoogleLoginDto, @Request() req: any) {
    return this.authService.googleMobileLogin(dto.idToken, req.ip);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req) {
    return this.authService.me(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@Request() req, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(req.user.userId, dto);
  }
}