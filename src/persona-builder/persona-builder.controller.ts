import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { PersonaBuilderService } from './persona-builder.service';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import { PersonaResponseDto, QuestionDto } from './dto/persona-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('persona-builder')
@ApiBearerAuth('JWT-auth')
@Controller('persona-builder')
@UseGuards(JwtAuthGuard)
export class PersonaBuilderController {
  constructor(private readonly personaBuilderService: PersonaBuilderService) {}

  @Get('questions')
  @ApiOperation({ summary: 'Get persona questions (managed on frontend)' })
  @ApiResponse({ status: 200, description: 'List of questions (empty as questions are managed on frontend)', type: [QuestionDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getQuestions(): Promise<QuestionDto[]> {
    return this.personaBuilderService.getQuestions();
  }

  @Post('answers')
  @ApiOperation({ summary: 'Submit answers to persona questions' })
  @ApiResponse({ status: 201, description: 'Answers submitted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: SubmitAnswersDto })
  async submitAnswers(
    @Request() req,
    @Body() submitDto: SubmitAnswersDto,
  ): Promise<{ message: string; count: number }> {
    const answers = await this.personaBuilderService.submitAnswers(
      req.user.id,
      submitDto,
    );
    return {
      message: 'Answers submitted successfully',
      count: answers.length,
    };
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate professional persona from submitted answers' })
  @ApiResponse({ status: 201, description: 'Persona generated successfully', type: PersonaResponseDto })
  @ApiResponse({ status: 400, description: 'No answers found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generatePersona(
    @Request() req,
  ): Promise<PersonaResponseDto> {
    return this.personaBuilderService.generatePersona(req.user.id);
  }

  @Get('persona')
  @ApiOperation({ summary: 'Get the generated professional persona' })
  @ApiResponse({ status: 200, description: 'Persona details', type: PersonaResponseDto })
  @ApiResponse({ status: 404, description: 'Persona not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPersona(
    @Request() req,
  ): Promise<PersonaResponseDto | null> {
    return this.personaBuilderService.getPersona(req.user.id);
  }
}

