import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { UsersService } from '../../users/users.service';
import { Role } from '../../users/enums/role.enum';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || '',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || '',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || '',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails } = profile;
    const user = {
      googleId: id,
      email: emails[0].value,
      name: name.givenName + ' ' + name.familyName,
      accessToken,
    };

    let dbUser = await this.usersService.findByGoogleId(id);
    if (!dbUser) {
      dbUser = await this.usersService.findByEmail(user.email);
      if (dbUser) {
        dbUser = await this.usersService.update(dbUser.id, {
          googleId: id,
        });
      } else {
        dbUser = await this.usersService.create({
          ...user,
          role: Role.User,
        });
      }
    }

    done(null, dbUser);
  }
}

